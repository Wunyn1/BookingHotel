const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { pool, connectDatabase, closeDatabase } = require('../src/core/config/database');
const { createBooking } = require('../src/modules/hotel/hotel.service');

let roomTypeId;
let roomIds = [];
let singleRoomTypeId;
let singleRoomId;
const day = (offset) => {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};
const bookingData = (checkIn, checkOut, roomCount = 1, typeId = roomTypeId) => ({
  roomTypeId: typeId,
  guestName: 'Integration Test',
  guestEmail: `test-${Date.now()}@example.com`,
  guestPhone: '0900000000',
  checkIn,
  checkOut,
  adults: 2,
  children: 0,
  roomCount,
  paymentMethod: 'pay_at_hotel',
});

before(async () => {
  await connectDatabase();
  const code = `TST${Date.now()}`;
  const type = await pool.query(`INSERT INTO hotel_room_types (code,name,description,area_m2,bed_type,capacity,base_price,weekend_price)
    VALUES ($1,$2,'Integration test',25,'1 double bed',2,700000,900000) RETURNING id`, [code, `Integration ${code}`]);
  roomTypeId = type.rows[0].id;
  for (let index = 1; index <= 2; index += 1) {
    const room = await pool.query('INSERT INTO hotel_rooms (room_type_id,room_number,floor) VALUES ($1,$2,99) RETURNING id', [roomTypeId, `${code}${index}`]);
    roomIds.push(room.rows[0].id);
  }
  const singleType = await pool.query(`INSERT INTO hotel_room_types (code,name,description,area_m2,bed_type,capacity,base_price,weekend_price)
    VALUES ($1,$2,'Single room integration test',25,'1 double bed',2,700000,700000) RETURNING id`, [`SNG${Date.now()}`, `Single integration ${code}`]);
  singleRoomTypeId = singleType.rows[0].id;
  const singleRoom = await pool.query('INSERT INTO hotel_rooms (room_type_id,room_number,floor) VALUES ($1,$2,98) RETURNING id', [singleRoomTypeId, `${code}S`]);
  singleRoomId = singleRoom.rows[0].id;
});

after(async () => {
  if (roomTypeId) {
    await pool.query('DELETE FROM hotel_bookings WHERE room_id = ANY($1::int[])', [roomIds]);
    await pool.query('DELETE FROM hotel_rooms WHERE id = ANY($1::int[])', [roomIds]);
    await pool.query('DELETE FROM hotel_room_types WHERE id=$1', [roomTypeId]);
    await pool.query('DELETE FROM hotel_bookings WHERE room_id=$1', [singleRoomId]);
    await pool.query('DELETE FROM hotel_rooms WHERE id=$1', [singleRoomId]);
    await pool.query('DELETE FROM hotel_room_types WHERE id=$1', [singleRoomTypeId]);
  }
  await closeDatabase();
});

test('concurrent booking: only one request confirms the same physical room', async () => {
  const [first, second] = await Promise.allSettled([
    createBooking(bookingData(day(10), day(12), 1, singleRoomTypeId)),
    createBooking(bookingData(day(10), day(12), 1, singleRoomTypeId)),
  ]);
  const fulfilled = [first, second].filter((result) => result.status === 'fulfilled');
  const rejected = [first, second].filter((result) => result.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.errorCode, 'ROOM_NOT_AVAILABLE');
});

test('adjacent bookings do not overlap', async () => {
  const booking = await createBooking(bookingData(day(20), day(22), 1, singleRoomTypeId));
  const adjacent = await createBooking(bookingData(day(22), day(24), 1, singleRoomTypeId));
  assert.equal(booking.status, 'confirmed');
  assert.equal(adjacent.status, 'confirmed');
  assert.notEqual(booking.bookingCode, adjacent.bookingCode);
});

test('overlapping booking is rejected', async () => {
  await assert.rejects(
    createBooking(bookingData(day(21), day(23), 1, singleRoomTypeId)),
    (error) => error.errorCode === 'ROOM_NOT_AVAILABLE',
  );
});

test('one booking can atomically reserve multiple rooms', async () => {
  const booking = await createBooking(bookingData(day(40), day(42), 2));
  assert.equal(booking.roomCount, 2);
  assert.equal(booking.roomIds.length, 2);
  assert.equal(booking.totalAmount, booking.pricing.total * 2);
});
