const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { pool, connectDatabase, closeDatabase } = require('../src/core/config/database');
const { createBooking } = require('../src/modules/hotel/hotel.service');
const operations = require('../src/modules/hotel/operations.service');

let roomTypeId;
let roomId;
let booking;
let staff;
const date = (offset) => { const value = new Date(); value.setUTCHours(0, 0, 0, 0); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); };

before(async () => {
  await connectDatabase();
  staff = (await pool.query("SELECT id,role FROM users WHERE email='reception@hotel.local'")).rows[0];
  const code = `P3${Date.now()}`;
  roomTypeId = (await pool.query("INSERT INTO hotel_room_types (code,name,capacity,base_price,weekend_price) VALUES ($1,$2,2,700000,700000) RETURNING id", [code, `Phase 3 ${code}`])).rows[0].id;
  roomId = (await pool.query('INSERT INTO hotel_rooms (room_type_id,room_number,floor) VALUES ($1,$2,96) RETURNING id', [roomTypeId, `${code}1`])).rows[0].id;
});
after(async () => {
  if (roomTypeId) {
    if (booking) await pool.query('DELETE FROM hotel_bookings WHERE id=$1', [booking.id]);
    await pool.query('DELETE FROM hotel_housekeeping_tasks WHERE room_id=$1', [roomId]);
    await pool.query('DELETE FROM hotel_rooms WHERE id=$1', [roomId]);
    await pool.query('DELETE FROM hotel_room_types WHERE id=$1', [roomTypeId]);
  }
  await closeDatabase();
});

test('front desk flow creates invoice and housekeeping task', async () => {
  booking = await createBooking({ roomTypeId, checkIn: date(100), checkOut: date(102), adults: 2, guestName: 'Operations Test', guestEmail: 'operations@example.com', guestPhone: '0900000010', paymentMethod: 'pay_at_hotel' }, staff);
  const checkedIn = await operations.checkIn(booking.id, { fullName: 'Operations Test', documentType: 'cccd', documentNumber: '012345678901' }, staff);
  assert.equal(checkedIn.status, 'checked_in');
  const services = await operations.getServices();
  assert.ok(services.length > 0);
  await operations.addService(booking.id, { serviceId: services[0].id, quantity: 2 }, staff);
  assert.equal((await operations.getBookingServices(booking.id)).length, 1);
  const result = await operations.checkout(booking.id, { settleRemaining: true, paymentMethod: 'pay_at_hotel' }, staff);
  assert.equal(result.booking.status, 'completed');
  assert.equal(result.invoice.remainingAmount, 0);
  const tasks = await operations.getHousekeepingTasks('dirty');
  const task = tasks.find((item) => item.bookingId === booking.id);
  assert.ok(task);
  await operations.updateHousekeepingTask(task.id, 'cleaning', staff);
  const ready = await operations.updateHousekeepingTask(task.id, 'ready', staff);
  assert.equal(ready.status, 'ready');
  const room = (await pool.query('SELECT status FROM hotel_rooms WHERE id=$1', [roomId])).rows[0];
  assert.equal(room.status, 'ready');
});
