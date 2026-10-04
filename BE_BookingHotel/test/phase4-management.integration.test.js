const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { pool, connectDatabase, closeDatabase } = require('../src/core/config/database');
const { createBooking } = require('../src/modules/hotel/hotel.service');
const management = require('../src/modules/hotel/management.service');

let roomTypeId;
let roomId;
let couponId;
let bookingIds = [];
let admin;
const day = (offset) => { const value = new Date(); value.setUTCHours(0, 0, 0, 0); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); };
before(async () => {
  await connectDatabase();
  admin = (await pool.query("SELECT id,role FROM users WHERE email='admin@hotel.local'")).rows[0];
  const code = `P4${Date.now()}`;
  roomTypeId = (await pool.query('INSERT INTO hotel_room_types (code,name,capacity,base_price,weekend_price) VALUES ($1,$2,2,700000,700000) RETURNING id', [code, `Phase 4 ${code}`])).rows[0].id;
  roomId = (await pool.query('INSERT INTO hotel_rooms (room_type_id,room_number,floor) VALUES ($1,$2,95) RETURNING id', [roomTypeId, `${code}1`])).rows[0].id;
  await management.upsertRate({ roomTypeId, rateDate: day(120), price: 1000000 }, admin);
  couponId = (await pool.query('INSERT INTO hotel_coupons (code,discount_type,discount_value,start_date,end_date,minimum_amount) VALUES ($1,\'fixed\',100000,CURRENT_DATE,CURRENT_DATE+10,0) RETURNING id', [`P4COUPON${Date.now()}`])).rows[0].id;
});
after(async () => {
  if (bookingIds.length) await pool.query('DELETE FROM hotel_bookings WHERE id=ANY($1::int[])', [bookingIds]);
  if (couponId) await pool.query('DELETE FROM hotel_coupons WHERE id=$1', [couponId]);
  await pool.query('DELETE FROM hotel_daily_rates WHERE room_type_id=$1', [roomTypeId]);
  await pool.query('DELETE FROM hotel_rooms WHERE id=$1', [roomId]);
  await pool.query('DELETE FROM hotel_room_types WHERE id=$1', [roomTypeId]);
  await closeDatabase();
});
test('daily rate and coupon are calculated by backend', async () => {
  const rated = await createBooking({ roomTypeId, checkIn: day(120), checkOut: day(121), adults: 2, guestName: 'Management Test', guestEmail: 'management@example.com', guestPhone: '0900000020', paymentMethod: 'pay_at_hotel' }, admin);
  bookingIds.push(rated.id);
  assert.equal(rated.totalAmount, 1000000);
  const discounted = await createBooking({ roomTypeId, checkIn: day(130), checkOut: day(131), adults: 2, couponCode: (await pool.query('SELECT code FROM hotel_coupons WHERE id=$1', [couponId])).rows[0].code, guestName: 'Coupon Test', guestEmail: 'coupon@example.com', guestPhone: '0900000021', paymentMethod: 'pay_at_hotel' }, admin);
  bookingIds.push(discounted.id);
  assert.equal(discounted.discountAmount, 100000);
  assert.equal(discounted.totalAmount, 600000);
  assert.ok((await management.analytics()).occupancy.rooms > 0);
});
