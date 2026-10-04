const crypto = require('crypto');
const { pool } = require('../../core/config/database');
const ApiError = require('../../core/errors/api-error');
const {
  ACTIVE_BOOKING_STATUSES,
  validateDateRange,
  calculateRoomPrice,
  assertTransition,
  assertPaymentMethod,
  listNights,
} = require('./booking.rules');
const { HOLD_MINUTES, lockActiveHold, markHoldConverted, linkHoldToBooking, expirePendingBookings } = require('./hold.service');
const { createPendingTransaction } = require('./payment.service');
const { sendBookingConfirmationEmail } = require('./email.service');

const STAFF_ROLES = ['admin', 'manager', 'receptionist', 'housekeeping'];
const money = (value) => Number(value || 0);
const asInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mapType = (row) => row && ({
  ...row,
  id: row.id,
  capacity: Number(row.capacity),
  areaM2: money(row.area_m2),
  basePrice: money(row.base_price),
  weekendPrice: money(row.weekend_price),
  amenities: row.amenities || [],
  images: row.images || [],
  availableRooms: Number(row.available_rooms || 0),
  totalRooms: Number(row.total_rooms || 0),
});
const mapBooking = (row) => row && ({
  id: row.id,
  bookingCode: row.booking_code,
  roomId: row.room_id,
  roomIds: row.room_ids || (row.room_id ? [row.room_id] : []),
  roomNumber: row.room_number,
  roomNumbers: row.room_numbers || (row.room_number ? [row.room_number] : []),
  roomCount: Number(row.room_count || row.room_numbers?.length || 1),
  roomTypeId: row.room_type_id,
  roomTypeName: row.room_type_name,
  guestName: row.guest_name,
  guestEmail: row.guest_email,
  guestPhone: row.guest_phone,
  adults: Number(row.adults),
  children: Number(row.children),
  checkIn: row.check_in,
  checkOut: row.check_out,
  nights: Number(row.nights || 0),
  specialRequest: row.special_request,
  totalAmount: money(row.total_amount),
  depositAmount: money(row.deposit_amount),
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  paymentExpiresAt: row.payment_expires_at,
  discountAmount: money(row.discount_amount),
  status: row.status,
  qrToken: row.qr_token,
  createdAt: row.created_at,
  checkedInAt: row.checked_in_at,
  checkedOutAt: row.checked_out_at,
});

const BOOKING_SELECT = `
  SELECT b.*, r.room_number, t.id AS room_type_id, t.name AS room_type_name,
    COALESCE(rel.room_count, b.room_count)::int AS room_count,
    rel.room_ids, rel.room_numbers,
    (b.check_out - b.check_in)::int AS nights
  FROM hotel_bookings b
  JOIN hotel_rooms r ON r.id = b.room_id
  JOIN hotel_room_types t ON t.id = r.room_type_id
  LEFT JOIN (
    SELECT br.booking_id, COUNT(*)::int AS room_count,
      ARRAY_AGG(br.room_id ORDER BY br.room_id) AS room_ids,
      ARRAY_AGG(r2.room_number ORDER BY r2.room_number) AS room_numbers
    FROM hotel_booking_rooms br
    JOIN hotel_rooms r2 ON r2.id = br.room_id
    GROUP BY br.booking_id
  ) rel ON rel.booking_id = b.id
`;
async function calculateDatabasePrice(client, roomType, checkIn, checkOut) {
  const nights = listNights(checkIn, checkOut);
  const rates = await client.query('SELECT rate_date,price FROM hotel_daily_rates WHERE room_type_id=$1 AND rate_date >= $2::date AND rate_date < $3::date', [roomType.id, checkIn, checkOut]);
  const rateMap = new Map(rates.rows.map((row) => [typeof row.rate_date === 'string' ? row.rate_date : new Date(row.rate_date).toLocaleDateString('en-CA'), Number(row.price)]));
  const weekendPrice = Number(roomType.weekend_price) > 0 ? Number(roomType.weekend_price) : Number(roomType.base_price);
  const nightlyPrices = nights.map((date) => {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, price: rateMap.get(date) ?? ([0, 6].includes(day) ? weekendPrice : Number(roomType.base_price)) };
  });
  return { nights: nightlyPrices.length, nightlyPrices, total: nightlyPrices.reduce((sum, night) => sum + night.price, 0) };
}

async function getRoomTypes({ checkIn, checkOut, adults = 1, children = 0, roomCount = 1 } = {}) {
  await expirePendingBookings();
  const hasDates = Boolean(checkIn && checkOut);
  if (hasDates) validateDateRange(checkIn, checkOut);
  const capacity = asInt(adults, 1) + asInt(children, 0);
  const requestedRooms = asInt(roomCount, 1);
  if (capacity < 1 || requestedRooms < 1) throw new ApiError(400, 'INVALID_GUEST_COUNT', 'Số lượng khách và phòng phải lớn hơn 0');

  const params = hasDates
    ? [checkIn, checkOut, capacity, requestedRooms, ACTIVE_BOOKING_STATUSES]
    : [capacity, requestedRooms];
  const capacityParam = hasDates ? 3 : 1;
  const roomCountParam = hasDates ? 4 : 2;
  const availabilitySql = hasDates
    ? `COUNT(r.id) FILTER (WHERE r.is_active=TRUE AND r.status <> 'maintenance' AND NOT EXISTS (
         SELECT 1 FROM hotel_booking_rooms br
         JOIN hotel_bookings b ON b.id = br.booking_id
         WHERE br.room_id = r.id AND b.status = ANY($5::text[])
           AND b.check_in < $2::date AND b.check_out > $1::date
       ) AND NOT EXISTS (
         SELECT 1 FROM hotel_room_hold_rooms hrr
         JOIN hotel_room_holds h ON h.id = hrr.hold_id
         WHERE hrr.room_id = r.id AND h.status='active' AND h.expires_at > NOW()
           AND h.check_in < $2::date AND h.check_out > $1::date
       )) AS available_rooms`
    : `COUNT(r.id) FILTER (WHERE r.is_active=TRUE AND r.status <> 'maintenance') AS available_rooms`;
  const result = await pool.query(`
    SELECT t.*, COUNT(r.id) FILTER (WHERE r.is_active=TRUE)::int AS total_rooms, ${availabilitySql}
    FROM hotel_room_types t LEFT JOIN hotel_rooms r ON r.room_type_id = t.id
    WHERE t.is_active = TRUE AND t.capacity >= $${capacityParam}
    GROUP BY t.id
    HAVING ${hasDates ? 'COUNT(r.id) FILTER (WHERE r.is_active=TRUE AND r.status <> \'maintenance\' AND NOT EXISTS (SELECT 1 FROM hotel_booking_rooms br JOIN hotel_bookings b ON b.id=br.booking_id WHERE br.room_id=r.id AND b.status=ANY($5::text[]) AND b.check_in < $2::date AND b.check_out > $1::date) AND NOT EXISTS (SELECT 1 FROM hotel_room_hold_rooms hrr JOIN hotel_room_holds h ON h.id=hrr.hold_id WHERE hrr.room_id=r.id AND h.status=\'active\' AND h.expires_at > NOW() AND h.check_in < $2::date AND h.check_out > $1::date))' : 'COUNT(r.id) FILTER (WHERE r.is_active=TRUE AND r.status <> \'maintenance\')'} >= $${roomCountParam}
    ORDER BY t.base_price ASC`, params);
  return result.rows.map(mapType);
}

async function getRoomType(id, dates = {}) {
  const rows = await getRoomTypes({ ...dates, roomCount: dates.roomCount || 1 });
  const type = rows.find((item) => String(item.id) === String(id));
  if (!type) throw new ApiError(404, 'ROOM_TYPE_NOT_FOUND', 'Không tìm thấy loại phòng');
  const result = await pool.query('SELECT id, room_number, floor, status FROM hotel_rooms WHERE room_type_id=$1 AND is_active=TRUE ORDER BY room_number', [id]);
  const rating = await pool.query('SELECT COALESCE(AVG(rating),0)::numeric(3,2) AS average, COUNT(*)::int AS count FROM hotel_reviews WHERE room_type_id=$1', [id]);
  return { ...type, rooms: result.rows.map((room) => ({ id: room.id, roomNumber: room.room_number, floor: room.floor, status: room.status })), rating: Number(rating.rows[0].average), reviewCount: rating.rows[0].count };
}

async function createBooking(data, user) {
  const {
    roomTypeId, guestName, guestEmail, guestPhone, checkIn, checkOut,
    adults = 1, children = 0, roomCount = 1, specialRequest = '', paymentMethod = 'pay_at_hotel', holdToken = '', couponCode = '',
  } = data;
  validateDateRange(checkIn, checkOut);
  assertPaymentMethod(paymentMethod);
  if (!guestName?.trim() || !guestEmail?.trim() || !guestPhone?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập đủ thông tin người đặt phòng');

  const requestedRooms = asInt(roomCount, 1);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await expirePendingBookings(client);
    const typeResult = await client.query('SELECT * FROM hotel_room_types WHERE id=$1 AND is_active=TRUE FOR SHARE', [roomTypeId]);
    const type = typeResult.rows[0];
    if (!type) throw new ApiError(404, 'ROOM_TYPE_NOT_FOUND', 'Không tìm thấy loại phòng');
    if (asInt(adults, 1) + asInt(children, 0) > Number(type.capacity)) throw new ApiError(422, 'CAPACITY_EXCEEDED', 'Số lượng khách vượt quá sức chứa phòng');

    // Lock every candidate room of this type. This serializes competing bookings
    // for the same inventory before the overlap query is evaluated.
    let selected = [];
    let hold = null;
    if (holdToken) {
      const lockedHold = await lockActiveHold(client, holdToken, { roomTypeId, checkIn, checkOut, roomCount: requestedRooms });
      hold = lockedHold.hold;
      selected = lockedHold.rooms;
    } else {
      const rooms = await client.query(`SELECT id, room_number FROM hotel_rooms WHERE room_type_id=$1 AND is_active=TRUE AND status <> 'maintenance' ORDER BY id FOR UPDATE`, [roomTypeId]);
      for (const room of rooms.rows) {
        const conflict = await client.query(`
          SELECT 1 FROM hotel_booking_rooms br
          JOIN hotel_bookings b ON b.id = br.booking_id
          WHERE br.room_id=$1 AND b.status = ANY($4::text[])
            AND b.check_in < $3::date AND b.check_out > $2::date
          UNION ALL
          SELECT 1 FROM hotel_room_hold_rooms hrr
          JOIN hotel_room_holds h ON h.id=hrr.hold_id
          WHERE hrr.room_id=$1 AND h.status='active' AND h.expires_at > NOW()
            AND h.check_in < $3::date AND h.check_out > $2::date
          LIMIT 1`, [room.id, checkIn, checkOut, ACTIVE_BOOKING_STATUSES]);
        if (!conflict.rowCount) selected.push(room);
        if (selected.length === requestedRooms) break;
      }
    }
    if (selected.length < requestedRooms) throw new ApiError(409, 'ROOM_NOT_AVAILABLE', 'Không đủ phòng trống trong toàn bộ khoảng thời gian đã chọn');

    const pricing = await calculateDatabasePrice(client, type, checkIn, checkOut);
    const grossTotal = pricing.total * requestedRooms;
    let discount = 0;
    let coupon = null;
    if (couponCode?.trim()) {
      coupon = (await client.query("SELECT * FROM hotel_coupons WHERE code=$1 AND is_active=TRUE AND CURRENT_DATE BETWEEN start_date AND end_date FOR UPDATE", [couponCode.trim().toUpperCase()])).rows[0];
      if (!coupon) throw new ApiError(422, 'INVALID_COUPON', 'Mã giảm giá không hợp lệ hoặc đã hết hạn');
      if (coupon.usage_limit !== null && Number(coupon.used_count) >= Number(coupon.usage_limit)) throw new ApiError(422, 'COUPON_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng');
      if (grossTotal < Number(coupon.minimum_amount)) throw new ApiError(422, 'COUPON_MINIMUM_NOT_MET', 'Đơn hàng chưa đạt giá trị tối thiểu của mã giảm giá');
      if (user?.id) {
        const used = await client.query('SELECT COUNT(*)::int AS count FROM hotel_coupon_usages WHERE coupon_id=$1 AND user_id=$2', [coupon.id, user.id]);
        if (Number(used.rows[0].count) >= Number(coupon.usage_per_user)) throw new ApiError(422, 'COUPON_USER_LIMIT', 'Bạn đã sử dụng mã giảm giá này quá số lần cho phép');
      }
      discount = coupon.discount_type === 'percentage' ? grossTotal * Number(coupon.discount_value) / 100 : Number(coupon.discount_value);
      if (coupon.maximum_discount !== null) discount = Math.min(discount, Number(coupon.maximum_discount));
      discount = Math.min(grossTotal, Math.round(discount));
    }
    const total = grossTotal - discount;
    const deposit = paymentMethod === 'pay_at_hotel' ? 0 : Math.round(total * 0.3);
    const bookingStatus = paymentMethod === 'pay_at_hotel' ? 'confirmed' : 'pending_payment';
    const paymentExpiresAt = paymentMethod === 'pay_at_hotel' ? null : new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
    const bookingCode = `BK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const qrToken = crypto.randomUUID();
    const inserted = await client.query(`
      INSERT INTO hotel_bookings
        (booking_code,user_id,room_id,room_count,guest_name,guest_email,guest_phone,adults,children,check_in,check_out,special_request,total_amount,deposit_amount,payment_method,status,payment_expires_at,qr_token)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`, [
      bookingCode, user?.id || null, selected[0].id, requestedRooms, guestName.trim(), guestEmail.trim().toLowerCase(), guestPhone.trim(),
      asInt(adults, 1), asInt(children, 0), checkIn, checkOut, specialRequest.trim(), total, deposit, paymentMethod, bookingStatus, paymentExpiresAt, qrToken,
    ]);
    if (coupon) {
      await client.query('UPDATE hotel_bookings SET coupon_id=$1,discount_amount=$2 WHERE id=$3', [coupon.id, discount, inserted.rows[0].id]);
      await client.query('INSERT INTO hotel_coupon_usages (coupon_id,booking_id,user_id,discount_amount) VALUES ($1,$2,$3,$4)', [coupon.id, inserted.rows[0].id, user?.id || null, discount]);
      await client.query('UPDATE hotel_coupons SET used_count=used_count+1 WHERE id=$1', [coupon.id]);
    }
    for (const room of selected) await client.query('INSERT INTO hotel_booking_rooms (booking_id, room_id) VALUES ($1,$2)', [inserted.rows[0].id, room.id]);
    if (hold) {
      if (bookingStatus === 'confirmed') await markHoldConverted(client, hold.id, inserted.rows[0].id);
      else await linkHoldToBooking(client, hold.id, inserted.rows[0].id);
    }
    const payment = paymentMethod === 'pay_at_hotel' ? null : await createPendingTransaction(client, {
      bookingId: inserted.rows[0].id, method: paymentMethod, amount: deposit, idempotencyKey: `booking-${inserted.rows[0].id}`, metadata: { mode: 'sandbox', depositPercent: 30 },
    });
    await client.query('COMMIT');
    const confirmationEmail = bookingStatus === 'confirmed'
      ? await sendBookingConfirmationEmail(inserted.rows[0].id)
      : { sent: false, reason: 'WAITING_FOR_PAYMENT' };
    return {
      ...mapBooking({ ...inserted.rows[0], discount_amount: discount, room_number: selected[0].room_number, room_numbers: selected.map((room) => room.room_number), room_ids: selected.map((room) => room.id), room_type_id: roomTypeId, room_type_name: type.name, nights: pricing.nights }),
      roomType: mapType(type),
      pricing,
      payment,
      confirmationEmail,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getBookings(user, query = {}) {
  const params = [];
  const where = [];
  if (!STAFF_ROLES.includes(user.role)) { params.push(user.id); where.push(`b.user_id=$${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`b.status=$${params.length}`); }
  const result = await pool.query(`${BOOKING_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY b.created_at DESC LIMIT 100`, params);
  return result.rows.map(mapBooking);
}

async function getBookingById(id, user) {
  const result = await pool.query(`${BOOKING_SELECT} WHERE b.id=$1`, [id]);
  const booking = result.rows[0];
  if (!booking) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt phòng');
  if (user && !STAFF_ROLES.includes(user.role) && String(booking.user_id) !== String(user.id)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem đơn đặt phòng này');
  return mapBooking(booking);
}

async function lookupBooking(code) {
  const result = await pool.query(`${BOOKING_SELECT} WHERE b.booking_code=$1 OR b.qr_token=$1`, [code]);
  if (!result.rows[0]) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy mã đặt phòng');
  return mapBooking(result.rows[0]);
}

async function cancelBooking(id, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM hotel_bookings WHERE id=$1 FOR UPDATE', [id]);
    const booking = result.rows[0];
    if (!booking) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt phòng');
    if (!STAFF_ROLES.includes(user.role) && String(booking.user_id) !== String(user.id)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền hủy đơn đặt phòng này');
    assertTransition(booking.status, 'cancelled');
    await client.query("UPDATE hotel_bookings SET status='cancelled', updated_at=NOW() WHERE id=$1", [id]);
    await client.query('COMMIT');
    return getBookingById(id, user);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateBookingStatus(id, status) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await client.query('SELECT * FROM hotel_bookings WHERE id=$1 FOR UPDATE', [id]);
    if (!row.rows[0]) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt phòng');
    assertTransition(row.rows[0].status, status);
    await client.query(`UPDATE hotel_bookings SET status=$1,
      checked_in_at=CASE WHEN $1='checked_in' THEN NOW() ELSE checked_in_at END,
      checked_out_at=CASE WHEN $1='checked_out' THEN NOW() ELSE checked_out_at END,
      updated_at=NOW() WHERE id=$2`, [status, id]);
    if (status === 'checked_in') await client.query("UPDATE hotel_rooms SET status='occupied', updated_at=NOW() WHERE id IN (SELECT room_id FROM hotel_booking_rooms WHERE booking_id=$1)", [id]);
    if (status === 'checked_out') await client.query("UPDATE hotel_rooms SET status='cleaning', updated_at=NOW() WHERE id IN (SELECT room_id FROM hotel_booking_rooms WHERE booking_id=$1)", [id]);
    await client.query('COMMIT');
    return getBookingById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getRooms() {
  const result = await pool.query('SELECT r.id,r.room_number,r.floor,r.status,r.is_active,t.id AS room_type_id,t.name AS room_type_name,t.base_price FROM hotel_rooms r JOIN hotel_room_types t ON t.id=r.room_type_id WHERE r.is_active=TRUE ORDER BY r.floor,r.room_number');
  return result.rows.map((r) => ({ id: r.id, roomNumber: r.room_number, floor: r.floor, status: r.status, isActive: r.is_active, roomTypeId: r.room_type_id, roomTypeName: r.room_type_name, basePrice: money(r.base_price) }));
}
async function updateRoomStatus(id, status) {
  if (!['available', 'ready', 'cleaning', 'maintenance'].includes(status)) throw new ApiError(400, 'INVALID_ROOM_STATUS', 'Trạng thái phòng không hợp lệ');
  const result = await pool.query('UPDATE hotel_rooms SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, room_number, floor, status', [status, id]);
  if (!result.rows[0]) throw new ApiError(404, 'ROOM_NOT_FOUND', 'Không tìm thấy phòng');
  return result.rows[0];
}

async function getDashboard() {
  const [rooms, bookings, revenue, types] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active=TRUE AND status IN ('available','ready'))::int AS available, COUNT(*) FILTER (WHERE is_active=TRUE AND status='occupied')::int AS occupied, COUNT(*) FILTER (WHERE is_active=TRUE AND status IN ('dirty','cleaning'))::int AS cleaning, COUNT(*) FILTER (WHERE is_active=TRUE AND status='maintenance')::int AS maintenance FROM hotel_rooms WHERE is_active=TRUE"),
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='confirmed')::int AS confirmed, COUNT(*) FILTER (WHERE status='checked_in')::int AS checked_in, COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled FROM hotel_bookings"),
    pool.query("SELECT COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled','expired')),0)::numeric AS total, COALESCE(SUM(total_amount) FILTER (WHERE created_at >= date_trunc('month', NOW()) AND status NOT IN ('cancelled','expired')),0)::numeric AS this_month FROM hotel_bookings"),
    pool.query("SELECT t.name, COUNT(b.id)::int AS bookings FROM hotel_room_types t JOIN hotel_rooms r ON r.room_type_id=t.id AND r.is_active=TRUE LEFT JOIN hotel_bookings b ON b.room_id=r.id AND b.status NOT IN ('cancelled','expired') WHERE t.is_active=TRUE GROUP BY t.id ORDER BY bookings DESC"),
  ]);
  const room = rooms.rows[0];
  return { rooms: { total: room.total, available: room.available, occupied: room.occupied, cleaning: room.cleaning, maintenance: room.maintenance }, bookings: bookings.rows[0], revenue: { total: money(revenue.rows[0].total), thisMonth: money(revenue.rows[0].this_month) }, popularRoomTypes: types.rows };
}

async function getReviews(roomTypeId) {
  const result = await pool.query('SELECT id,guest_name AS "guestName",rating,comment,created_at AS "createdAt" FROM hotel_reviews WHERE ($1::int IS NULL OR room_type_id=$1) ORDER BY created_at DESC LIMIT 50', [roomTypeId || null]);
  return result.rows;
}
async function createReview(data, user) {
  const { bookingId, rating, comment = '' } = data;
  const booking = await pool.query("SELECT b.*,r.room_type_id FROM hotel_bookings b JOIN hotel_rooms r ON r.id=b.room_id WHERE b.id=$1 AND b.status='completed'", [bookingId]);
  if (!booking.rows[0]) throw new ApiError(422, 'REVIEW_NOT_ALLOWED', 'Chỉ khách đã hoàn tất lưu trú mới được đánh giá');
  const b = booking.rows[0];
  if (user && b.user_id && String(b.user_id) !== String(user.id)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền đánh giá đơn này');
  const result = await pool.query('INSERT INTO hotel_reviews (booking_id,room_type_id,guest_name,rating,comment) VALUES ($1,$2,$3,$4,$5) RETURNING *', [bookingId, b.room_type_id, b.guest_name, rating, comment]);
  return result.rows[0];
}

module.exports = { getRoomTypes, getRoomType, createBooking, getBookings, getBookingById, lookupBooking, cancelBooking, updateBookingStatus, getRooms, updateRoomStatus, getDashboard, getReviews, createReview };
