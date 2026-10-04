const crypto = require('crypto');
const { pool } = require('../../core/config/database');
const ApiError = require('../../core/errors/api-error');
const { PAYMENT_METHODS } = require('./booking.rules');
const { expirePendingBookings } = require('./hold.service');
const { sendBookingConfirmationEmail } = require('./email.service');

const STAFF_ROLES = ['admin', 'manager', 'receptionist', 'housekeeping'];
const mapPayment = (row) => ({
  id: row.id,
  bookingId: row.booking_id,
  idempotencyKey: row.idempotency_key,
  providerReference: row.provider_reference,
  method: row.method,
  amount: Number(row.amount),
  status: row.status,
  gateway: row.gateway,
  createdAt: row.created_at,
  paidAt: row.paid_at,
});

async function createPendingTransaction(client, { bookingId, method, amount, idempotencyKey, metadata = {} }) {
  const key = idempotencyKey || `booking-${bookingId}`;
  const existing = await client.query('SELECT * FROM hotel_payment_transactions WHERE idempotency_key=$1', [key]);
  if (existing.rows[0]) return mapPayment(existing.rows[0]);
  const result = await client.query(`INSERT INTO hotel_payment_transactions
    (booking_id,idempotency_key,provider_reference,method,amount,status,metadata)
    VALUES ($1,$2,$3,$4,$5,'pending',$6::jsonb) RETURNING *`,
  [bookingId, key, `SBX-${crypto.randomBytes(8).toString('hex').toUpperCase()}`, method, amount, JSON.stringify(metadata)]);
  return mapPayment(result.rows[0]);
}

async function getTransaction(id, user) {
  const result = await pool.query(`SELECT p.*,b.user_id FROM hotel_payment_transactions p JOIN hotel_bookings b ON b.id=p.booking_id WHERE p.id=$1`, [id]);
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Không tìm thấy giao dịch thanh toán');
  if (user && !STAFF_ROLES.includes(user.role) && String(row.user_id) !== String(user.id)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem giao dịch này');
  return mapPayment(row);
}

async function createPayment({ bookingId, method, idempotencyKey }, user) {
  if (!PAYMENT_METHODS.includes(method)) throw new ApiError(400, 'INVALID_PAYMENT_METHOD', 'Phương thức thanh toán không hợp lệ');
  if (!idempotencyKey?.trim()) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Thiếu idempotency key cho thanh toán');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await expirePendingBookings(client);
    const bookingResult = await client.query('SELECT * FROM hotel_bookings WHERE id=$1 FOR UPDATE', [bookingId]);
    const booking = bookingResult.rows[0];
    if (!booking) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt phòng');
    if (!STAFF_ROLES.includes(user.role) && String(booking.user_id) !== String(user.id)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thanh toán đơn này');
    if (booking.payment_method !== method) throw new ApiError(409, 'PAYMENT_METHOD_MISMATCH', 'Phương thức thanh toán không khớp với booking');
    const amount = Number(booking.deposit_amount) > 0 ? Number(booking.deposit_amount) : Number(booking.total_amount);
    if (booking.status !== 'pending_payment' && booking.payment_status !== 'pending') throw new ApiError(422, 'BOOKING_NOT_PAYABLE', 'Booking không ở trạng thái chờ thanh toán');
    const existingForBooking = await client.query("SELECT * FROM hotel_payment_transactions WHERE booking_id=$1 AND status IN ('pending','success') ORDER BY id DESC LIMIT 1", [bookingId]);
    if (existingForBooking.rows[0]) {
      await client.query('COMMIT');
      return mapPayment(existingForBooking.rows[0]);
    }
    const payment = await createPendingTransaction(client, { bookingId, method, amount, idempotencyKey: idempotencyKey.trim(), metadata: { mode: 'sandbox' } });
    await client.query('COMMIT');
    return payment;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function applySandboxResult(id, status, user) {
  if (!['success', 'failed', 'cancelled'].includes(status)) throw new ApiError(400, 'INVALID_PAYMENT_STATUS', 'Trạng thái thanh toán không hợp lệ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await expirePendingBookings(client);
    const paymentResult = await client.query('SELECT p.*,b.user_id,b.status AS booking_status FROM hotel_payment_transactions p JOIN hotel_bookings b ON b.id=p.booking_id WHERE p.id=$1 FOR UPDATE', [id]);
    const payment = paymentResult.rows[0];
    if (!payment) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Không tìm thấy giao dịch thanh toán');
    if (!STAFF_ROLES.includes(user.role) && String(payment.user_id) !== String(user.id)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền cập nhật giao dịch này');
    if (payment.booking_status === 'expired') {
      await client.query("UPDATE hotel_payment_transactions SET status='cancelled',updated_at=NOW() WHERE id=$1 AND status='pending'", [id]);
      await client.query('COMMIT');
      throw new ApiError(410, 'PAYMENT_EXPIRED', 'Thời gian thanh toán đã hết');
    }
    if (payment.status !== 'pending') {
      await client.query('COMMIT');
      return getTransaction(id, user);
    }
    if (status === 'success') {
      await client.query("UPDATE hotel_payment_transactions SET status='success',paid_at=NOW(),updated_at=NOW() WHERE id=$1", [id]);
      await client.query("UPDATE hotel_bookings SET payment_status='success',status=CASE WHEN status='pending_payment' THEN 'confirmed' ELSE status END,updated_at=NOW() WHERE id=$1", [payment.booking_id]);
      await client.query("UPDATE hotel_room_holds SET status='converted',updated_at=NOW() WHERE id=(SELECT hold_id FROM hotel_bookings WHERE id=$1) AND status='active'", [payment.booking_id]);
      await client.query(`INSERT INTO hotel_payments (booking_id,transaction_ref,amount,method,status,paid_at)
        VALUES ($1,$2,$3,$4,'success',NOW()) ON CONFLICT (transaction_ref) DO NOTHING`, [payment.booking_id, payment.provider_reference, payment.amount, payment.method]);
    } else {
      await client.query("UPDATE hotel_payment_transactions SET status=$1,updated_at=NOW() WHERE id=$2", [status, id]);
      await client.query("UPDATE hotel_bookings SET payment_status=$1,status=CASE WHEN status='pending_payment' THEN 'cancelled' ELSE status END,updated_at=NOW() WHERE id=$2", [status, payment.booking_id]);
      await client.query("UPDATE hotel_room_holds SET status='cancelled',updated_at=NOW() WHERE id=(SELECT hold_id FROM hotel_bookings WHERE id=$1) AND status='active'", [payment.booking_id]);
    }
    await client.query('COMMIT');
    const confirmationEmail = status === 'success'
      ? await sendBookingConfirmationEmail(payment.booking_id)
      : null;
    const transaction = await getTransaction(id, user);
    return confirmationEmail ? { ...transaction, confirmationEmail } : transaction;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createPendingTransaction, createPayment, applySandboxResult, getTransaction };
