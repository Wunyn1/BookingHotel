/**
 * Tiện ích ký và xác thực JWT token.
 * Quy ước: Sử dụng 1 JWT có hạn 7 ngày, KHÔNG dùng refresh token theo 02 FR-08 và 07 §4.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Tạo token JWT với payload tối giản (userId, role).
 * KHÔNG đưa thông tin nhạy cảm vào payload (07 §4.1).
 * @param {object} payload - { userId, role }
 * @param {string} [expiresIn] - Mặc định 7 ngày từ config
 * @returns {string} Chuỗi JWT đã ký
 */
const generateToken = (payload, expiresIn = config.auth.jwtExpiresIn) => {
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn });
};

/**
 * Giải mã và kiểm tra tính hợp lệ của token.
 * @param {string} token
 * @returns {object} Payload đã giải mã
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.auth.jwtSecret);
};

module.exports = {
  generateToken,
  verifyToken,
};
