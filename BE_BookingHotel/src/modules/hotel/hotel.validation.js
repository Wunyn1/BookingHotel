const Joi = require('joi');

const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required();
const positiveInt = Joi.number().integer().min(1);

const dateRange = Joi.object({
  checkIn: date,
  checkOut: date,
  adults: positiveInt.default(1),
  children: Joi.number().integer().min(0).default(0),
  roomCount: positiveInt.default(1),
}).custom((value, helpers) => {
  if (value.checkOut <= value.checkIn) return helpers.error('date.range');
  return value;
}).messages({ 'date.range': 'checkOut must be after checkIn' });

const searchSchema = dateRange.unknown(false);
const bookingSchema = dateRange.keys({
  roomTypeId: positiveInt.required(),
  holdToken: Joi.string().trim().max(100).allow(null, ''),
  couponCode: Joi.string().trim().uppercase().max(40).allow(''),
  guestName: Joi.string().trim().min(2).max(150).required(),
  guestEmail: Joi.string().email({ tlds: false }).trim().required(),
  guestPhone: Joi.string().trim().pattern(/^[0-9+().\s-]{8,20}$/).required(),
  specialRequest: Joi.string().allow('').max(2000).default(''),
  paymentMethod: Joi.string().valid('pay_at_hotel', 'vietqr', 'vnpay', 'momo', 'card', 'bank_transfer').default('pay_at_hotel'),
}).unknown(false);

const statusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show').required(),
}).unknown(false);
const reviewSchema = Joi.object({
  bookingId: positiveInt.required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('').max(2000).default(''),
}).unknown(false);
const roomStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'cleaning', 'maintenance').required(),
}).unknown(false);

module.exports = { searchSchema, bookingSchema, statusSchema, reviewSchema, roomStatusSchema };
