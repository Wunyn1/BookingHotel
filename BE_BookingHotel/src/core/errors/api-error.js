/**
 * Custom Error class cho Hotel Booking.
 * Bắt buộc mang mã HTTP status code và mã lỗi chuẩn (errorCode) theo API.md §12.
 */

class ApiError extends Error {
  /**
   * @param {number} statusCode - Mã HTTP trạng thái (400, 401, 403, 404, 409, 422, 500...)
   * @param {string} errorCode - Mã lỗi định danh máy đọc (VD: 'VALIDATION_ERROR', 'FORBIDDEN')
   * @param {string} message - Thông báo lỗi thân thiện cho người dùng bằng Tiếng Việt
   * @param {any} [data=null] - Dữ liệu chi tiết lỗi kèm theo (ví dụ: mảng field errors khi validate)
   */
  constructor(statusCode, errorCode, message, data = null) {
    // Hỗ trợ trường hợp truyền (statusCode, message, errorCode) phòng ngừa nhầm lẫn thứ tự
    let normalizedCode = errorCode;
    let normalizedMessage = message;

    if (
      typeof errorCode === 'string' &&
      typeof message === 'string' &&
      errorCode.includes(' ') &&
      /^[A-Z0-9_]+$/.test(message)
    ) {
      normalizedCode = message;
      normalizedMessage = errorCode;
    }

    super(normalizedMessage || 'Đã có lỗi xảy ra');
    this.name = 'ApiError';
    this.statusCode = Number(statusCode) || 500;
    this.errorCode = normalizedCode || 'INTERNAL_ERROR';
    this.data = data;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Dữ liệu không hợp lệ', errorCode = 'VALIDATION_ERROR', data = null) {
    return new ApiError(400, errorCode, message, data);
  }

  static unauthorized(message = 'Bạn chưa đăng nhập hoặc phiên đã hết hạn', errorCode = 'UNAUTHORIZED') {
    return new ApiError(401, errorCode, message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này', errorCode = 'FORBIDDEN') {
    return new ApiError(403, errorCode, message);
  }

  static notFound(message = 'Không tìm thấy tài nguyên yêu cầu', errorCode = 'NOT_FOUND') {
    return new ApiError(404, errorCode, message);
  }

  static conflict(message = 'Xung đột dữ liệu', errorCode = 'DUPLICATE_ENTRY', data = null) {
    return new ApiError(409, errorCode, message, data);
  }

  static unprocessable(message = 'Dữ liệu vi phạm quy tắc nghiệp vụ', errorCode = 'UNPROCESSABLE_ENTITY', data = null) {
    return new ApiError(422, errorCode, message, data);
  }

  static internal(message = 'Lỗi máy chủ nội bộ', errorCode = 'INTERNAL_ERROR') {
    return new ApiError(500, errorCode, message);
  }
}

module.exports = ApiError;
