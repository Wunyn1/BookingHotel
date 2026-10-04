const Joi = require('joi');
const password = Joi.string().pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/).required();
const registerSchema = Joi.object({ fullName: Joi.string().trim().min(2).max(150).required(), email: Joi.string().email({ tlds: false }).trim().required(), password });
const loginSchema = Joi.object({ email: Joi.string().email({ tlds: false }).trim().required(), password: Joi.string().required() });
const changePasswordSchema = Joi.object({ oldPassword: Joi.string().required(), newPassword: password.invalid(Joi.ref('oldPassword')) });
module.exports = { registerSchema, loginSchema, changePasswordSchema };
