const { pool } = require('../../core/config/database');
const ApiError = require('../../core/errors/api-error');

async function audit(actor, action, entity, entityId, oldValue = null, newValue = null, db = pool) {
  await db.query('INSERT INTO hotel_audit_logs (actor_id,action,entity,entity_id,old_value,new_value) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)', [actor?.id || null, action, entity, String(entityId || ''), oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]);
}
async function roomTypes() {
  const result = await pool.query('SELECT id,name,code,description,area_m2 AS "areaM2",bed_type AS "bedType",capacity,base_price AS "basePrice",weekend_price AS "weekendPrice",amenities,is_active AS "isActive" FROM hotel_room_types ORDER BY id');
  return result.rows.map((row) => ({ ...row, areaM2: Number(row.areaM2), capacity: Number(row.capacity), basePrice: Number(row.basePrice), weekendPrice: Number(row.weekendPrice) }));
}
async function createRoomType(data, user) {
  const result = await pool.query('INSERT INTO hotel_room_types (name,code,description,area_m2,bed_type,capacity,base_price,weekend_price,amenities,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [data.name, data.code, data.description || '', data.areaM2 || 25, data.bedType || '1 giường đôi', data.capacity, data.basePrice, data.weekendPrice || data.basePrice, data.amenities || [], data.isActive !== false]);
  await audit(user, 'ROOM_TYPE_CREATED', 'room_type', result.rows[0].id, null, data);
  return result.rows[0];
}
async function updateRoomType(id, data, user) {
  const old = (await pool.query('SELECT * FROM hotel_room_types WHERE id=$1', [id])).rows[0];
  if (!old) throw new ApiError(404, 'ROOM_TYPE_NOT_FOUND', 'Không tìm thấy loại phòng');
  const result = await pool.query('UPDATE hotel_room_types SET name=COALESCE($1,name),code=COALESCE($2,code),description=COALESCE($3,description),area_m2=COALESCE($4,area_m2),bed_type=COALESCE($5,bed_type),capacity=COALESCE($6,capacity),base_price=COALESCE($7,base_price),weekend_price=COALESCE($8,weekend_price),amenities=COALESCE($9,amenities),is_active=COALESCE($10,is_active),updated_at=NOW() WHERE id=$11 RETURNING *', [data.name ?? null, data.code ?? null, data.description ?? null, data.areaM2 ?? null, data.bedType ?? null, data.capacity ?? null, data.basePrice ?? null, data.weekendPrice ?? null, data.amenities ?? null, data.isActive ?? null, id]);
  await audit(user, 'ROOM_TYPE_UPDATED', 'room_type', id, old, data);
  return result.rows[0];
}
async function deleteRoomType(id, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const old = (await client.query('SELECT * FROM hotel_room_types WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!old) throw new ApiError(404, 'ROOM_TYPE_NOT_FOUND', 'Không tìm thấy loại phòng');
    const usage = (await client.query(`SELECT COUNT(DISTINCT b.id)::int AS count
      FROM hotel_bookings b JOIN hotel_rooms r ON r.id=b.room_id WHERE r.room_type_id=$1`, [id])).rows[0];
    await client.query("UPDATE hotel_room_types SET is_active=FALSE,updated_at=NOW() WHERE id=$1", [id]);
    await client.query("UPDATE hotel_rooms SET is_active=FALSE,status='maintenance',updated_at=NOW() WHERE room_type_id=$1", [id]);
    await audit(user, 'ROOM_TYPE_DEACTIVATED', 'room_type', id, { isActive: old.is_active }, { isActive: false, bookingCount: usage.count }, client);
    await client.query('COMMIT');
    return { id: Number(id), isActive: false, softDeleted: true, bookingCount: Number(usage.count), message: 'Loại phòng đã được ẩn để bảo toàn lịch sử đặt phòng' };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function rooms() {
  const result = await pool.query(`SELECT r.id,r.room_number AS "roomNumber",r.floor,r.status,r.is_active AS "isActive",
    t.id AS "roomTypeId",t.name AS "roomTypeName",t.code AS "roomTypeCode"
    FROM hotel_rooms r JOIN hotel_room_types t ON t.id=r.room_type_id ORDER BY r.floor,r.room_number`);
  return result.rows;
}
async function createRoom(data, user) {
  const type = (await pool.query('SELECT id FROM hotel_room_types WHERE id=$1 AND is_active=TRUE', [data.roomTypeId])).rows[0];
  if (!type) throw new ApiError(422, 'ROOM_TYPE_NOT_AVAILABLE', 'Loại phòng không tồn tại hoặc đã bị ẩn');
  const result = await pool.query('INSERT INTO hotel_rooms (room_type_id,room_number,floor,status,is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *', [data.roomTypeId, data.roomNumber, data.floor, data.status || 'available', data.isActive !== false]);
  await audit(user, 'ROOM_CREATED', 'room', result.rows[0].id, null, data);
  return result.rows[0];
}
async function updateRoom(id, data, user) {
  const old = (await pool.query('SELECT * FROM hotel_rooms WHERE id=$1', [id])).rows[0];
  if (!old) throw new ApiError(404, 'ROOM_NOT_FOUND', 'Không tìm thấy phòng');
  if (data.roomTypeId) {
    const type = (await pool.query('SELECT id FROM hotel_room_types WHERE id=$1 AND is_active=TRUE', [data.roomTypeId])).rows[0];
    if (!type) throw new ApiError(422, 'ROOM_TYPE_NOT_AVAILABLE', 'Loại phòng không tồn tại hoặc đã bị ẩn');
  }
  const result = await pool.query('UPDATE hotel_rooms SET room_type_id=COALESCE($1,room_type_id),room_number=COALESCE($2,room_number),floor=COALESCE($3,floor),status=COALESCE($4,status),is_active=COALESCE($5,is_active),updated_at=NOW() WHERE id=$6 RETURNING *', [data.roomTypeId ?? null, data.roomNumber ?? null, data.floor ?? null, data.status ?? null, data.isActive ?? null, id]);
  await audit(user, 'ROOM_UPDATED', 'room', id, old, data);
  return result.rows[0];
}
async function deleteRoom(id, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const old = (await client.query('SELECT * FROM hotel_rooms WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!old) throw new ApiError(404, 'ROOM_NOT_FOUND', 'Không tìm thấy phòng');
    const usage = (await client.query('SELECT COUNT(*)::int AS count FROM hotel_booking_rooms WHERE room_id=$1', [id])).rows[0];
    await client.query("UPDATE hotel_rooms SET is_active=FALSE,status='maintenance',updated_at=NOW() WHERE id=$1", [id]);
    await audit(user, 'ROOM_DEACTIVATED', 'room', id, { isActive: old.is_active, status: old.status }, { isActive: false, status: 'maintenance', bookingCount: usage.count }, client);
    await client.query('COMMIT');
    return { id: Number(id), isActive: false, softDeleted: true, bookingCount: Number(usage.count), message: 'Phòng đã được ẩn và chuyển sang bảo trì để bảo toàn lịch sử đặt phòng' };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function listRates(roomTypeId) {
  const result = await pool.query('SELECT id,room_type_id AS "roomTypeId",rate_date AS "rateDate",price FROM hotel_daily_rates WHERE ($1::int IS NULL OR room_type_id=$1) ORDER BY rate_date', [roomTypeId || null]);
  return result.rows.map((row) => ({ ...row, price: Number(row.price) }));
}
async function upsertRate(data, user) {
  const result = await pool.query('INSERT INTO hotel_daily_rates (room_type_id,rate_date,price) VALUES ($1,$2,$3) ON CONFLICT (room_type_id,rate_date) DO UPDATE SET price=EXCLUDED.price RETURNING id,room_type_id AS "roomTypeId",rate_date AS "rateDate",price', [data.roomTypeId, data.rateDate, data.price]);
  await audit(user, 'RATE_CHANGED', 'daily_rate', result.rows[0].id, null, data);
  return { ...result.rows[0], price: Number(result.rows[0].price) };
}
async function services() {
  const result = await pool.query('SELECT id,name,description,unit_price AS "unitPrice",is_active AS "isActive" FROM hotel_services ORDER BY name');
  return result.rows.map((row) => ({ ...row, unitPrice: Number(row.unitPrice) }));
}
async function createService(data, user) {
  const result = await pool.query('INSERT INTO hotel_services (name,description,unit_price) VALUES ($1,$2,$3) RETURNING id,name,description,unit_price AS "unitPrice",is_active AS "isActive"', [data.name, data.description || '', data.unitPrice]);
  await audit(user, 'SERVICE_CREATED', 'service', result.rows[0].id, null, data);
  return { ...result.rows[0], unitPrice: Number(result.rows[0].unitPrice) };
}
async function coupons() {
  const result = await pool.query('SELECT * FROM hotel_coupons ORDER BY start_date DESC');
  return result.rows;
}
async function createCoupon(data, user) {
  const result = await pool.query('INSERT INTO hotel_coupons (code,discount_type,discount_value,start_date,end_date,minimum_amount,maximum_discount,usage_limit,usage_per_user) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [data.code.toUpperCase(), data.discountType, data.discountValue, data.startDate, data.endDate, data.minimumAmount || 0, data.maximumDiscount || null, data.usageLimit || null, data.usagePerUser || 1]);
  await audit(user, 'COUPON_CREATED', 'coupon', result.rows[0].id, null, data);
  return result.rows[0];
}
async function analytics() {
  const [revenue, bookings, paymentMethods, occupancy] = await Promise.all([
    pool.query("SELECT TO_CHAR(created_at::date,'YYYY-MM-DD') AS date,COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled','expired')),0)::numeric AS revenue,COUNT(*)::int AS bookings FROM hotel_bookings WHERE created_at >= CURRENT_DATE-INTERVAL '30 days' GROUP BY created_at::date ORDER BY created_at::date"),
    pool.query("SELECT status,COUNT(*)::int AS count FROM hotel_bookings GROUP BY status ORDER BY status"),
    pool.query("SELECT payment_method AS method,COUNT(*)::int AS count,COALESCE(SUM(total_amount),0)::numeric AS amount FROM hotel_bookings GROUP BY payment_method ORDER BY count DESC"),
    pool.query("SELECT COUNT(*)::int AS rooms,COUNT(*) FILTER (WHERE status='occupied')::int AS occupied,COUNT(*) FILTER (WHERE status IN ('available','ready'))::int AS available FROM hotel_rooms WHERE is_active=TRUE"),
  ]);
  const occ = occupancy.rows[0];
  return { revenueByDay: revenue.rows.map((row) => ({ ...row, revenue: Number(row.revenue) })), bookingsByStatus: bookings.rows, paymentMethods: paymentMethods.rows.map((row) => ({ ...row, amount: Number(row.amount) })), occupancy: { rooms: occ.rooms, occupied: occ.occupied, available: occ.available, rate: occ.rooms ? Math.round((occ.occupied / occ.rooms) * 10000) / 100 : 0 } };
}
async function auditLogs(limit = 100) {
  const result = await pool.query('SELECT id,actor_id AS "actorId",action,entity,entity_id AS "entityId",old_value AS "oldValue",new_value AS "newValue",created_at AS "createdAt" FROM hotel_audit_logs ORDER BY created_at DESC LIMIT $1', [Math.min(500, Math.max(1, Number(limit) || 100))]);
  return result.rows;
}
async function users() {
  const result = await pool.query('SELECT id,email,full_name AS "fullName",role,is_active AS "isActive",created_at AS "createdAt" FROM users ORDER BY created_at DESC');
  return result.rows;
}
async function updateUser(id, data, actor) {
  const old = (await pool.query('SELECT id,email,full_name AS "fullName",role,is_active AS "isActive" FROM users WHERE id=$1', [id])).rows[0];
  if (!old) throw new ApiError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  const result = await pool.query('UPDATE users SET role=COALESCE($1,role),is_active=COALESCE($2,is_active),updated_at=NOW() WHERE id=$3 RETURNING id,email,full_name AS "fullName",role,is_active AS "isActive"', [data.role ?? null, data.isActive ?? null, id]);
  await audit(actor, 'USER_UPDATED', 'user', id, old, result.rows[0]);
  return result.rows[0];
}

module.exports = { roomTypes, createRoomType, updateRoomType, deleteRoomType, rooms, createRoom, updateRoom, deleteRoom, listRates, upsertRate, services, createService, coupons, createCoupon, analytics, auditLogs, users, updateUser };
