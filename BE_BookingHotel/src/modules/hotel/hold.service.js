const crypto = require('crypto');
const { pool } = require('../../core/config/database');
const ApiError = require('../../core/errors/api-error');
const { ACTIVE_BOOKING_STATUSES, validateDateRange } = require('./booking.rules');

const HOLD_MINUTES = 15;
const asInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const dateText = (value) => {
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

async function expireStaleHolds(client = pool) {
  await client.query("UPDATE hotel_room_holds SET status='expired', updated_at=NOW() WHERE status='active' AND expires_at <= NOW()");
}
async function expirePendingBookings(client = pool) {
  await client.query("UPDATE hotel_bookings SET status='expired',payment_status='cancelled',updated_at=NOW() WHERE status='pending_payment' AND payment_expires_at IS NOT NULL AND payment_expires_at <= NOW()");
  await expireStaleHolds(client);
}

async function findAvailableRooms(client, roomTypeId, checkIn, checkOut, roomCount, excludedHoldId = null) {
  const rooms = await client.query(`SELECT id, room_number FROM hotel_rooms
    WHERE room_type_id=$1 AND is_active=TRUE AND status <> 'maintenance' ORDER BY id FOR UPDATE`, [roomTypeId]);
  const selected = [];
  for (const room of rooms.rows) {
    const conflict = await client.query(`
      SELECT 1 FROM hotel_booking_rooms br
      JOIN hotel_bookings b ON b.id=br.booking_id
      WHERE br.room_id=$1 AND b.status=ANY($4::text[])
        AND b.check_in < $3::date AND b.check_out > $2::date
      UNION ALL
      SELECT 1 FROM hotel_room_hold_rooms hrr
      JOIN hotel_room_holds h ON h.id=hrr.hold_id
      WHERE hrr.room_id=$1 AND h.status='active' AND h.expires_at > NOW()
        AND ($5::int IS NULL OR h.id <> $5)
        AND h.check_in < $3::date AND h.check_out > $2::date
      LIMIT 1`, [room.id, checkIn, checkOut, ACTIVE_BOOKING_STATUSES, excludedHoldId]);
    if (!conflict.rowCount) selected.push(room);
    if (selected.length === roomCount) break;
  }
  return selected;
}

async function createHold(data, user) {
  const { roomTypeId, checkIn, checkOut, roomCount = 1, adults = 1, children = 0 } = data;
  validateDateRange(checkIn, checkOut);
  const requestedRooms = asInt(roomCount, 1);
  if (requestedRooms < 1 || asInt(adults, 1) + asInt(children, 0) < 1) throw new ApiError(400, 'INVALID_GUEST_COUNT', 'Số lượng khách và phòng phải lớn hơn 0');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await expirePendingBookings(client);
    const type = (await client.query('SELECT capacity FROM hotel_room_types WHERE id=$1 AND is_active=TRUE FOR SHARE', [roomTypeId])).rows[0];
    if (!type) throw new ApiError(404, 'ROOM_TYPE_NOT_FOUND', 'Không tìm thấy loại phòng');
    if (asInt(adults, 1) + asInt(children, 0) > Number(type.capacity)) throw new ApiError(422, 'CAPACITY_EXCEEDED', 'Số lượng khách vượt quá sức chứa phòng');
    const rooms = await findAvailableRooms(client, roomTypeId, checkIn, checkOut, requestedRooms);
    if (rooms.length < requestedRooms) throw new ApiError(409, 'ROOM_NOT_AVAILABLE', 'Không đủ phòng trống để giữ trong khoảng thời gian đã chọn');
    const holdToken = `HLD-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    const hold = await client.query(`INSERT INTO hotel_room_holds
      (hold_token,room_type_id,user_id,room_count,check_in,check_out,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW() + ($7 * INTERVAL '1 minute')) RETURNING id,hold_token,expires_at`,
    [holdToken, roomTypeId, user?.id || null, requestedRooms, checkIn, checkOut, HOLD_MINUTES]);
    for (const room of rooms) await client.query('INSERT INTO hotel_room_hold_rooms (hold_id,room_id) VALUES ($1,$2)', [hold.rows[0].id, room.id]);
    await client.query('COMMIT');
    return { id: hold.rows[0].id, holdToken, roomTypeId: Number(roomTypeId), roomCount: requestedRooms, roomIds: rooms.map((room) => room.id), roomNumbers: rooms.map((room) => room.room_number), checkIn, checkOut, expiresAt: hold.rows[0].expires_at, ttlMinutes: HOLD_MINUTES };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function lockActiveHold(client, holdToken, data) {
  const result = await client.query('SELECT * FROM hotel_room_holds WHERE hold_token=$1 FOR UPDATE', [holdToken]);
  const hold = result.rows[0];
  if (!hold) throw new ApiError(404, 'HOLD_NOT_FOUND', 'Room hold không tồn tại');
  if (hold.status !== 'active' || new Date(hold.expires_at) <= new Date()) {
    if (hold.status === 'active') await client.query("UPDATE hotel_room_holds SET status='expired',updated_at=NOW() WHERE id=$1", [hold.id]);
    throw new ApiError(410, 'HOLD_EXPIRED', 'Thời gian giữ phòng đã hết, vui lòng chọn lại phòng');
  }
  if (String(hold.room_type_id) !== String(data.roomTypeId) || dateText(hold.check_in) !== data.checkIn || dateText(hold.check_out) !== data.checkOut || Number(hold.room_count) !== Number(data.roomCount)) {
    throw new ApiError(409, 'HOLD_MISMATCH', 'Thông tin booking không khớp với room hold');
  }
  const rooms = await client.query(`SELECT r.id,r.room_number FROM hotel_room_hold_rooms hrr JOIN hotel_rooms r ON r.id=hrr.room_id WHERE hrr.hold_id=$1 ORDER BY r.id FOR UPDATE OF r`, [hold.id]);
  if (rooms.rowCount !== Number(hold.room_count)) throw new ApiError(409, 'HOLD_INVALID', 'Room hold không còn hợp lệ');
  return { hold, rooms: rooms.rows };
}

async function markHoldConverted(client, holdId, bookingId) {
  await client.query("UPDATE hotel_room_holds SET status='converted', updated_at=NOW() WHERE id=$1", [holdId]);
  await client.query('UPDATE hotel_bookings SET hold_id=$1 WHERE id=$2', [holdId, bookingId]);
}
async function linkHoldToBooking(client, holdId, bookingId) {
  await client.query('UPDATE hotel_bookings SET hold_id=$1 WHERE id=$2', [holdId, bookingId]);
}

async function getHold(holdToken) {
  await expireStaleHolds();
  const result = await pool.query(`SELECT h.*, ARRAY_AGG(hrr.room_id ORDER BY hrr.room_id) AS room_ids, ARRAY_AGG(r.room_number ORDER BY r.room_number) AS room_numbers
    FROM hotel_room_holds h JOIN hotel_room_hold_rooms hrr ON hrr.hold_id=h.id JOIN hotel_rooms r ON r.id=hrr.room_id
    WHERE h.hold_token=$1 GROUP BY h.id`, [holdToken]);
  const hold = result.rows[0];
  if (!hold) throw new ApiError(404, 'HOLD_NOT_FOUND', 'Room hold không tồn tại');
  return { id: hold.id, holdToken: hold.hold_token, roomTypeId: hold.room_type_id, roomCount: hold.room_count, roomIds: hold.room_ids, roomNumbers: hold.room_numbers, checkIn: hold.check_in, checkOut: hold.check_out, status: hold.status, expiresAt: hold.expires_at };
}

async function cancelHold(holdToken, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM hotel_room_holds WHERE hold_token=$1 FOR UPDATE', [holdToken]);
    const hold = result.rows[0];
    if (!hold) throw new ApiError(404, 'HOLD_NOT_FOUND', 'Room hold không tồn tại');
    if (user?.id && hold.user_id && String(user.id) !== String(hold.user_id) && !['admin', 'manager', 'receptionist'].includes(user.role)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền hủy room hold này');
    if (hold.status === 'active') await client.query("UPDATE hotel_room_holds SET status='cancelled',updated_at=NOW() WHERE id=$1", [hold.id]);
    await client.query('COMMIT');
    return getHold(holdToken);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { HOLD_MINUTES, createHold, lockActiveHold, markHoldConverted, linkHoldToBooking, getHold, cancelHold, expireStaleHolds, expirePendingBookings, findAvailableRooms };
