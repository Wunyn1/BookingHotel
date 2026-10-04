const ApiError = require('../../core/errors/api-error');

const ACTIVE_BOOKING_STATUSES = ['pending_payment', 'confirmed', 'checked_in'];
const PAYMENT_METHODS = ['pay_at_hotel', 'vietqr', 'vnpay', 'momo', 'card', 'bank_transfer'];
const BOOKING_TRANSITIONS = {
  pending_payment: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
  no_show: [],
};

const toDate = (value) => new Date(`${value}T00:00:00Z`);
const isDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(toDate(value).getTime());
const validateDateRange = (checkIn, checkOut) => {
  if (!isDateOnly(checkIn) || !isDateOnly(checkOut) || checkOut <= checkIn) {
    throw new ApiError(400, 'INVALID_DATE_RANGE', 'Ngày nhận phòng và trả phòng không hợp lệ');
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (toDate(checkIn) < today) throw new ApiError(400, 'CHECK_IN_IN_PAST', 'Ngày nhận phòng không được ở quá khứ');
};
const nightsBetween = (checkIn, checkOut) => Math.round((toDate(checkOut) - toDate(checkIn)) / 86400000);
const isWeekend = (date) => [0, 6].includes(toDate(date).getUTCDay());
const listNights = (checkIn, checkOut) => {
  const result = [];
  for (let cursor = toDate(checkIn); cursor < toDate(checkOut); cursor = new Date(cursor.getTime() + 86400000)) {
    result.push(cursor.toISOString().slice(0, 10));
  }
  return result;
};
const calculateRoomPrice = (roomType, checkIn, checkOut) => {
  const nightlyPrices = listNights(checkIn, checkOut).map((date) => ({
    date,
    price: Number(isWeekend(date) && Number(roomType.weekend_price) > 0 ? roomType.weekend_price : roomType.base_price),
  }));
  return {
    nights: nightlyPrices.length,
    nightlyPrices,
    total: nightlyPrices.reduce((sum, night) => sum + night.price, 0),
  };
};
const assertTransition = (from, to) => {
  if (!BOOKING_TRANSITIONS[from]?.includes(to)) {
    throw new ApiError(422, 'INVALID_BOOKING_TRANSITION', `Không thể chuyển booking từ ${from} sang ${to}`);
  }
};
const assertPaymentMethod = (method) => {
  if (!PAYMENT_METHODS.includes(method)) throw new ApiError(400, 'INVALID_PAYMENT_METHOD', 'Phương thức thanh toán không hợp lệ');
};

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  PAYMENT_METHODS,
  BOOKING_TRANSITIONS,
  validateDateRange,
  nightsBetween,
  listNights,
  calculateRoomPrice,
  assertTransition,
  assertPaymentMethod,
};
