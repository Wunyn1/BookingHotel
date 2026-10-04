/**
 * Router định tuyến cho Module Auth.
 * Khai báo các endpoint theo hợp đồng API.md §2.
 */

const express = require('express');
const router = express.Router();

const authController = require('./auth.controller');
const { registerSchema, loginSchema, changePasswordSchema } = require('./auth.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate } = require('../../core/middlewares/auth');
const createRateLimiter = require('../../core/middlewares/rate-limiter');

// Rate limiter cho đăng nhập: tối đa 10 lần trong 15 phút (FR-05)
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút',
});

// 1. Đăng ký tài khoản khách hàng (Public)
router.post('/register', validate(registerSchema), authController.register);

// 2. Đăng nhập (Public có Rate Limiter)
router.post('/login', loginLimiter, validate(loginSchema), authController.login);

// 3. Đăng xuất (Yêu cầu đăng nhập)
router.post('/logout', authenticate, authController.logout);

// 4. Lấy thông tin tài khoản hiện tại (Yêu cầu đăng nhập)
router.get('/me', authenticate, authController.getMe);

// 5. Đổi mật khẩu cá nhân (Yêu cầu đăng nhập)
router.patch('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
