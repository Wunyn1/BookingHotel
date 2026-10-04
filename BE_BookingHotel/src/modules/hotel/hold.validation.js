const Joi = require('joi');

const holdSchema = Joi.object({
  roomTypeId: Joi.number().integer().min(1).required(),
  checkIn: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  checkOut: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  roomCount: Joi.number().integer().min(1).default(1),
  adults: Joi.number().integer().min(1).default(1),
  children: Joi.number().integer().min(0).default(0),
}).custom((value, helpers) => value.checkOut > value.checkIn ? value : helpers.error('date.range'))
  .messages({ 'date.range': 'checkOut must be after checkIn' }).unknown(false);

module.exports = { holdSchema };
