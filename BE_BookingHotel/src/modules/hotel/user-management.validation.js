const Joi = require('joi');
const userUpdateSchema = Joi.object({ role: Joi.string().valid('customer', 'receptionist', 'housekeeping', 'manager', 'admin'), isActive: Joi.boolean() }).min(1).unknown(false);
module.exports = { userUpdateSchema };
