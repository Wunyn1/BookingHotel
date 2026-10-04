const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { pool, connectDatabase, closeDatabase } = require('../src/core/config/database');
const { createHold, getHold } = require('../src/modules/hotel/hold.service');
const { createBooking } = require('../src/modules/hotel/hotel.service');
const { createPayment, applySandboxResult } = require('../src/modules/hotel/payment.service');

let roomTypeId;
let roomId;
let customer;
const day = (offset) => {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

before(async () => {
  await connectDatabase();
  customer = (await pool.query("SELECT id,role FROM users WHERE email='customer@hotel.local'")).rows[0];
  const code = `P2${Date.now()}`;
  roomTypeId = (await pool.query(`INSERT INTO hotel_room_types (code,name,description,area_m2,bed_type,capacity,base_price,weekend_price)
    VALUES ($1,$2,'Phase 2 integration test',25,'1 double bed',2,700000,700000) RETURNING id`, [code, `Phase 2 ${code}`])).rows[0].id;
  roomId = (await pool.query('INSERT INTO hotel_rooms (room_type_id,room_number,floor) VALUES ($1,$2,97) RETURNING id', [roomTypeId, `${code}1`])).rows[0].id;
});

after(async () => {
  if (roomTypeId) {
    await pool.query('DELETE FROM hotel_bookings WHERE room_id=$1', [roomId]);
    await pool.query('DELETE FROM hotel_room_holds WHERE room_type_id=$1', [roomTypeId]);
    await pool.query('DELETE FROM hotel_rooms WHERE id=$1', [roomId]);
    await pool.query('DELETE FROM hotel_room_types WHERE id=$1', [roomTypeId]);
  }
  await closeDatabase();
});

test('room hold blocks inventory and converts into a pending-payment booking', async () => {
  const checkIn = day(60);
  const checkOut = day(62);
  const hold = await createHold({ roomTypeId, checkIn, checkOut, roomCount: 1, adults: 2 }, customer);
  assert.equal(hold.ttlMinutes, 15);
  await assert.rejects(
    createHold({ roomTypeId, checkIn, checkOut, roomCount: 1, adults: 2 }, customer),
    (error) => error.errorCode === 'ROOM_NOT_AVAILABLE',
  );
  const booking = await createBooking({
    roomTypeId, checkIn, checkOut, roomCount: 1, adults: 2,
    guestName: 'Phase 2 Test', guestEmail: 'phase2@example.com', guestPhone: '0900000000',
    paymentMethod: 'momo', holdToken: hold.holdToken,
  }, customer);
  assert.equal(booking.status, 'pending_payment');
  assert.equal(booking.paymentStatus, 'pending');
  assert.equal(booking.payment.status, 'pending');
  assert.equal((await getHold(hold.holdToken)).status, 'active');
  await applySandboxResult(booking.payment.id, 'success', customer);
  assert.equal((await getHold(hold.holdToken)).status, 'converted');
});

test('sandbox payment callback is idempotent', async () => {
  const booking = await createBooking({
    roomTypeId, checkIn: day(70), checkOut: day(72), roomCount: 1, adults: 2,
    guestName: 'Payment Test', guestEmail: 'payment@example.com', guestPhone: '0900000001',
    paymentMethod: 'vietqr',
  }, customer);
  const first = await applySandboxResult(booking.payment.id, 'success', customer);
  const second = await applySandboxResult(booking.payment.id, 'success', customer);
  assert.equal(first.status, 'success');
  assert.equal(second.status, 'success');
  const rows = await pool.query('SELECT COUNT(*)::int AS count FROM hotel_payments WHERE booking_id=$1', [booking.id]);
  assert.equal(rows.rows[0].count, 1);
  const bookingRow = (await pool.query('SELECT status,payment_status FROM hotel_bookings WHERE id=$1', [booking.id])).rows[0];
  assert.equal(bookingRow.status, 'confirmed');
  assert.equal(bookingRow.payment_status, 'success');
});

test('expired hold cannot be used for booking', async () => {
  const hold = await createHold({ roomTypeId, checkIn: day(80), checkOut: day(82), roomCount: 1, adults: 2 }, customer);
  await pool.query("UPDATE hotel_room_holds SET expires_at=NOW()-INTERVAL '1 minute' WHERE hold_token=$1", [hold.holdToken]);
  await assert.rejects(
    createBooking({
      roomTypeId, checkIn: day(80), checkOut: day(82), roomCount: 1, adults: 2,
      guestName: 'Expired Hold', guestEmail: 'expired@example.com', guestPhone: '0900000002',
      paymentMethod: 'pay_at_hotel', holdToken: hold.holdToken,
    }, customer),
    (error) => error.errorCode === 'HOLD_EXPIRED',
  );
});

test('payment idempotency key returns the same transaction', async () => {
  const booking = await createBooking({
    roomTypeId, checkIn: day(90), checkOut: day(92), roomCount: 1, adults: 2,
    guestName: 'Idempotency Test', guestEmail: 'idempotency@example.com', guestPhone: '0900000003',
    paymentMethod: 'momo',
  }, customer);
  const first = await createPayment({ bookingId: booking.id, method: 'momo', idempotencyKey: `retry-${booking.id}-abc` }, customer);
  const second = await createPayment({ bookingId: booking.id, method: 'momo', idempotencyKey: `retry-${booking.id}-abc` }, customer);
  assert.equal(first.id, second.id);
});
