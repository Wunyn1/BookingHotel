const Joi = require('joi');

const paymentCreateSchema = Joi.object({
  bookingId: Joi.number().integer().min(1).required(),
  method: Joi.string().valid('vietqr', 'vnpay', 'momo', 'card', 'bank_transfer').required(),
  idempotencyKey: Joi.string().trim().min(8).max(120).required(),
}).unknown(false);

module.exports = { paymentCreateSchema };
