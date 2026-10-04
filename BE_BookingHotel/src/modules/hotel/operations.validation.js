const Joi = require('joi');

const checkInSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(150).allow(''),
  documentType: Joi.string().valid('cccd', 'passport', 'cmnd').allow(null, ''),
  documentNumber: Joi.string().trim().max(40).allow(''),
  nationality: Joi.string().trim().max(80).allow(''),
}).unknown(false);
const serviceSchema = Joi.object({ serviceId: Joi.number().integer().min(1).required(), quantity: Joi.number().integer().min(1).max(100).default(1) }).unknown(false);
const checkoutSchema = Joi.object({ settleRemaining: Joi.boolean().default(false), paymentMethod: Joi.string().valid('pay_at_hotel', 'vietqr', 'vnpay', 'momo', 'card', 'bank_transfer').default('pay_at_hotel') }).unknown(false);
const taskStatusSchema = Joi.object({ status: Joi.string().valid('dirty', 'assigned', 'cleaning', 'ready', 'cancelled').required() }).unknown(false);
module.exports = { checkInSchema, serviceSchema, checkoutSchema, taskStatusSchema };
