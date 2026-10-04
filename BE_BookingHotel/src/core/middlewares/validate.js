/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào sử dụng Joi.
 * Định dạng phản hồi lỗi chuẩn theo API.md §1.1:
 * {
 *   "code": "VALIDATION_ERROR",
 *   "message": "Dữ liệu không hợp lệ",
 *   "data": { "errors": [ { "field": "fieldName", "message": "..." } ] }
 * }
 */

const ApiError = require('../errors/api-error');

/**
 * Tạo middleware validate theo Joi schema
 * @param {import('joi').ObjectSchema} schema - Schema của Joi
 * @param {'body'|'query'|'params'} [source='body'] - Nguồn dữ liệu cần validate
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    if (!schema) return next();

    const dataToValidate = req[source] || {};
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Thu thập tất cả các lỗi thay vì dừng ở lỗi đầu tiên
      allowUnknown: true,
      stripUnknown: true, // G2: Loại bỏ triệt để các trường ngoài schema (chống mass-assignment)
    });

    if (error) {
      const formattedErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));

      return next(
        new ApiError(
          400,
          'VALIDATION_ERROR',
          'Dữ liệu không hợp lệ',
          { errors: formattedErrors }
        )
      );
    }

    // G1: Express 5 xử lý req.query an toàn (req.query là getter-only trong Express 5)
    if (source === 'query') {
      req.validatedQuery = value;
      try {
        for (const k of Object.keys(req.query)) {
          delete req.query[k];
        }
        Object.assign(req.query, value);
      } catch (e) {
        // Nếu req.query bị đóng băng hoặc không cho sửa, req.validatedQuery sẽ là nguồn chính
      }
    } else {
      req[source] = value;
    }

    return next();
  };
};

module.exports = validate;
