const crypto = require('crypto');
const { pool } = require('../../core/config/database');
const ApiError = require('../../core/errors/api-error');

const STAFF_ROLES = ['admin', 'manager', 'receptionist', 'housekeeping'];
const bookingSummarySql = `SELECT b.*,r.room_number,t.name AS room_type_name,
  COALESCE((SELECT ARRAY_AGG(r2.room_number ORDER BY r2.room_number) FROM hotel_booking_rooms br2 JOIN hotel_rooms r2 ON r2.id=br2.room_id WHERE br2.booking_id=b.id), ARRAY[r.room_number]) AS room_numbers
  FROM hotel_bookings b JOIN hotel_rooms r ON r.id=b.room_id JOIN hotel_room_types t ON t.id=r.room_type_id`;
const mapBooking = (row) => ({
  id: row.id, bookingCode: row.booking_code, status: row.status, paymentStatus: row.payment_status,
  guestName: row.guest_name, guestEmail: row.guest_email, guestPhone: row.guest_phone,
  roomNumber: row.room_number, roomNumbers: row.room_numbers || [row.room_number], roomTypeName: row.room_type_name,
  checkIn: row.check_in, checkOut: row.check_out, totalAmount: Number(row.total_amount), depositAmount: Number(row.deposit_amount),
  qrToken: row.qr_token, checkedInAt: row.checked_in_at, checkedOutAt: row.checked_out_at,
});

async function audit(client, actor, action, entity, entityId, oldValue = null, newValue = null) {
  await client.query('INSERT INTO hotel_audit_logs (actor_id,action,entity,entity_id,old_value,new_value) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [actor?.id || null, action, entity, String(entityId), oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]);
}
async function getBooking(id) {
  const result = await pool.query(`${bookingSummarySql} WHERE b.id=$1`, [id]);
  if (!result.rows[0]) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy booking');
  return mapBooking(result.rows[0]);
}
async function findBooking(value) {
  if (!value?.trim()) throw new ApiError(400, 'LOOKUP_REQUIRED', 'Nhập mã booking, số điện thoại hoặc mã QR');
  const result = await pool.query(`${bookingSummarySql} WHERE b.booking_code=$1 OR b.guest_phone=$1 OR b.qr_token=$1 ORDER BY b.created_at DESC LIMIT 1`, [value.trim()]);
  if (!result.rows[0]) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy booking');
  return getBooking(result.rows[0].id);
}

async function checkIn(id, data, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query('SELECT * FROM hotel_bookings WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy booking');
    if (row.status !== 'confirmed') throw new ApiError(422, 'INVALID_CHECK_IN', 'Booking phải ở trạng thái đã xác nhận mới được check-in');
    const fullName = String(data.fullName || row.guest_name).trim();
    const documentLast4 = data.documentNumber ? String(data.documentNumber).replace(/\D/g, '').slice(-4) : null;
    await client.query('INSERT INTO hotel_booking_guests (booking_id,full_name,document_type,document_last4,nationality) VALUES ($1,$2,$3,$4,$5)', [id, fullName, data.documentType || null, documentLast4, data.nationality || null]);
    await client.query("UPDATE hotel_bookings SET status='checked_in',checked_in_at=NOW(),updated_at=NOW() WHERE id=$1", [id]);
    await client.query("UPDATE hotel_rooms SET status='occupied',updated_at=NOW() WHERE id IN (SELECT room_id FROM hotel_booking_rooms WHERE booking_id=$1)", [id]);
    await audit(client, user, 'CHECK_IN', 'booking', id, { status: row.status }, { status: 'checked_in', documentLast4 });
    await client.query('COMMIT');
    return getBooking(id);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function getServices() {
  const result = await pool.query('SELECT id,name,description,unit_price AS "unitPrice",is_active AS "isActive" FROM hotel_services WHERE is_active=TRUE ORDER BY name');
  return result.rows.map((row) => ({ ...row, unitPrice: Number(row.unitPrice) }));
}
async function addService(bookingId, data, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const booking = (await client.query('SELECT status FROM hotel_bookings WHERE id=$1 FOR UPDATE', [bookingId])).rows[0];
    if (!booking) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy booking');
    if (booking.status !== 'checked_in') throw new ApiError(422, 'SERVICE_NOT_ALLOWED', 'Chỉ thêm dịch vụ khi khách đang lưu trú');
    const service = (await client.query('SELECT * FROM hotel_services WHERE id=$1 AND is_active=TRUE', [data.serviceId])).rows[0];
    if (!service) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ');
    const quantity = Math.max(1, Number(data.quantity || 1));
    const inserted = await client.query('INSERT INTO hotel_booking_services (booking_id,service_id,service_name,unit_price,quantity,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,service_name AS "serviceName",unit_price AS "unitPrice",quantity', [bookingId, service.id, service.name, service.unit_price, quantity, user.id]);
    await audit(client, user, 'SERVICE_ADDED', 'booking', bookingId, null, { serviceId: service.id, quantity });
    await client.query('COMMIT');
    return { ...inserted.rows[0], unitPrice: Number(inserted.rows[0].unitPrice), lineTotal: Number(inserted.rows[0].unitPrice) * Number(inserted.rows[0].quantity) };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function getBookingServices(bookingId) {
  const result = await pool.query('SELECT id,service_name AS "serviceName",unit_price AS "unitPrice",quantity,(unit_price*quantity) AS "lineTotal",created_at AS "createdAt" FROM hotel_booking_services WHERE booking_id=$1 ORDER BY created_at', [bookingId]);
  return result.rows.map((row) => ({ ...row, unitPrice: Number(row.unitPrice), quantity: Number(row.quantity), lineTotal: Number(row.lineTotal) }));
}

async function checkout(id, data, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const booking = (await client.query('SELECT * FROM hotel_bookings WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!booking) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy booking');
    if (booking.status !== 'checked_in') throw new ApiError(422, 'INVALID_CHECK_OUT', 'Booking phải ở trạng thái checked-in');
    const services = (await client.query('SELECT COALESCE(SUM(unit_price*quantity),0)::numeric AS total FROM hotel_booking_services WHERE booking_id=$1', [id])).rows[0];
    const roomAmount = Number(booking.total_amount);
    const servicesAmount = Number(services.total);
    const totalAmount = roomAmount + servicesAmount;
    const paid = (await client.query("SELECT COALESCE(SUM(amount),0)::numeric AS total FROM hotel_payments WHERE booking_id=$1 AND status='success'", [id])).rows[0];
    let paidAmount = Number(paid.total);
    let remaining = Math.max(0, totalAmount - paidAmount);
    if (data.settleRemaining && remaining > 0) {
      await client.query('INSERT INTO hotel_payments (booking_id,transaction_ref,amount,method,status,paid_at) VALUES ($1,$2,$3,$4,\'success\',NOW())', [id, `CHK-${crypto.randomBytes(7).toString('hex').toUpperCase()}`, remaining, data.paymentMethod || 'pay_at_hotel']);
      paidAmount += remaining;
      remaining = 0;
    }
    const invoice = await client.query(`INSERT INTO hotel_invoices (booking_id,invoice_number,room_amount,services_amount,total_amount,paid_amount,remaining_amount,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (booking_id) DO UPDATE SET room_amount=EXCLUDED.room_amount,services_amount=EXCLUDED.services_amount,total_amount=EXCLUDED.total_amount,paid_amount=EXCLUDED.paid_amount,remaining_amount=EXCLUDED.remaining_amount,status=EXCLUDED.status RETURNING *`, [id, `INV-${Date.now()}-${id}`, roomAmount, servicesAmount, totalAmount, paidAmount, remaining, remaining === 0 ? 'paid' : 'issued']);
    const nextStatus = remaining === 0 ? 'completed' : 'checked_out';
    await client.query('UPDATE hotel_bookings SET status=$1,checked_out_at=NOW(),updated_at=NOW() WHERE id=$2', [nextStatus, id]);
    await client.query("UPDATE hotel_rooms SET status='dirty',updated_at=NOW() WHERE id IN (SELECT room_id FROM hotel_booking_rooms WHERE booking_id=$1)", [id]);
    await client.query("INSERT INTO hotel_housekeeping_tasks (room_id,booking_id,task_type,priority,status) SELECT room_id,$1,'checkout_cleaning','normal','dirty' FROM hotel_booking_rooms WHERE booking_id=$1", [id]);
    await audit(client, user, 'CHECK_OUT', 'booking', id, { status: booking.status }, { status: nextStatus, invoiceId: invoice.rows[0].id });
    await client.query('COMMIT');
    return { booking: await getBooking(id), invoice: { ...invoice.rows[0], roomAmount, servicesAmount, totalAmount, paidAmount, remainingAmount: remaining } };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function getInvoice(bookingId) {
  const row = (await pool.query('SELECT * FROM hotel_invoices WHERE booking_id=$1', [bookingId])).rows[0];
  if (!row) throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Chưa có hóa đơn cho booking');
  return { ...row, roomAmount: Number(row.room_amount), servicesAmount: Number(row.services_amount), totalAmount: Number(row.total_amount), paidAmount: Number(row.paid_amount), remainingAmount: Number(row.remaining_amount) };
}

async function getHousekeepingTasks(status) {
  const params = []; const where = status ? 'WHERE h.status=$1' : '';
  if (status) params.push(status);
  const result = await pool.query(`SELECT h.id,h.room_id AS "roomId",r.room_number AS "roomNumber",r.floor,h.booking_id AS "bookingId",h.task_type AS "taskType",h.priority,h.status,h.notes,h.created_at AS "createdAt" FROM hotel_housekeeping_tasks h JOIN hotel_rooms r ON r.id=h.room_id ${where} ORDER BY CASE h.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,h.created_at`, params);
  return result.rows;
}
async function updateHousekeepingTask(id, status, user) {
  if (!['dirty', 'assigned', 'cleaning', 'ready', 'cancelled'].includes(status)) throw new ApiError(400, 'INVALID_TASK_STATUS', 'Trạng thái housekeeping không hợp lệ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const task = (await client.query('SELECT * FROM hotel_housekeeping_tasks WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'Không tìm thấy nhiệm vụ dọn phòng');
    await client.query('UPDATE hotel_housekeeping_tasks SET status=$1,assigned_to=COALESCE(assigned_to,$2),updated_at=NOW() WHERE id=$3', [status, user.id, id]);
    const roomStatus = status === 'ready' ? 'ready' : status === 'cleaning' ? 'cleaning' : status === 'dirty' ? 'dirty' : null;
    if (roomStatus) await client.query('UPDATE hotel_rooms SET status=$1,updated_at=NOW() WHERE id=$2', [roomStatus, task.room_id]);
    await audit(client, user, 'HOUSEKEEPING_STATUS_CHANGED', 'housekeeping_task', id, { status: task.status }, { status });
    await client.query('COMMIT');
    return (await getHousekeepingTasks()).find((item) => item.id === id);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

module.exports = { findBooking, checkIn, getServices, addService, getBookingServices, checkout, getInvoice, getHousekeepingTasks, updateHousekeepingTask };
