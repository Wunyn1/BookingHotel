/**
 * Middleware xử lý lỗi tập trung toàn hệ thống.
 * Đảm bảo mọi lỗi đều được trả về theo đúng envelope chuẩn { code, message, data } theo API.md §1.1.
 */

const ApiError = require('../errors/api-error');
const logger = require('../logger/logger');
const config = require('../config');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message || 'Lỗi máy chủ nội bộ';
  let data = err.data || null;

  // 1. Xử lý lỗi ApiError chuẩn
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    data = err.data;
  }
  // 2. Xử lý lỗi Mongoose CastError (ObjectId không đúng định dạng)
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = `Định dạng dữ liệu không hợp lệ cho trường: ${err.path}`;
    data = { field: err.path };
  }
  // 3. Xử lý lỗi Mongoose ValidationError (schema validation fail)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Dữ liệu không hợp lệ';
    const errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    data = { errors };
  }
  // 4. Xử lý lỗi ràng buộc PostgreSQL (duplicate, foreign key, invalid type)
  else if (err.code === '23505') {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'Giá trị đã tồn tại trong hệ thống';
    data = { constraint: err.constraint || null };
  } else if (err.code === '23503') {
    statusCode = 409;
    errorCode = 'DATA_INTEGRITY_ERROR';
    message = 'Dữ liệu đang được tham chiếu bởi bản ghi khác';
  } else if (err.code === '22P02') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Định dạng dữ liệu không hợp lệ';
  }
  // 5. Tương thích lỗi unique cũ trong dữ liệu MongoDB
  else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    message = `Giá trị của '${fields[0] || 'dữ liệu'}' đã tồn tại trong hệ thống`;
    data = { duplicateFields: fields };
  }
  // 5. Xử lý lỗi JWT
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Mã xác thực không hợp lệ';
  }
  // 6. Xử lý lỗi cú pháp JSON trong request body
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Định dạng JSON gửi lên không hợp lệ';
  }
  // 7. Lỗi chưa phân loại (500)
  else {
    statusCode = 500;
    errorCode = 'INTERNAL_ERROR';
    message = config.isProduction ? 'Lỗi máy chủ nội bộ' : err.message || 'Lỗi máy chủ nội bộ';
  }

  // Ghi log chi tiết lỗi
  if (statusCode >= 500) {
    logger.error(`[500 Server Error] ${req.method} ${req.originalUrl}`, err);
  } else {
    logger.warn(`[${statusCode} Handled Error] ${req.method} ${req.originalUrl} - ${errorCode}: ${message}`);
  }

  // Luôn trả về đúng envelope chuẩn { code, message, data }
  return res.status(statusCode).json({
    code: errorCode,
    message,
    data,
  });
};

module.exports = errorHandler;
