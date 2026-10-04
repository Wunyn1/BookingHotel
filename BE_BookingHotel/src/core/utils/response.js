/**
 * Chuẩn hóa Response Envelope cho toàn bộ API theo API.md §1.1 và §1.2.
 * Định dạng: { code, message, data }
 */

const ApiResponse = {
  /**
   * Trả về kết quả thành công HTTP 200
   */
  success(res, data = null, message = 'Thành công', statusCode = 200) {
    return res.status(statusCode).json({
      code: 'OK',
      message,
      data,
    });
  },

  /**
   * Trả về kết quả tạo mới thành công HTTP 201
   */
  created(res, data = null, message = 'Tạo mới thành công') {
    return res.status(201).json({
      code: 'OK',
      message,
      data,
    });
  },

  /**
   * Trả về danh sách có phân trang chuẩn theo API.md §1.2
   * Envelope: data: { items, total, page, limit }
   */
  paginate(res, items = [], total = 0, page = 1, limit = 20, message = 'Thành công', extra = {}) {
    return res.status(200).json({
      code: 'OK',
      message,
      data: {
        items,
        total: Number(total),
        page: Number(page),
        limit: Number(limit),
        ...extra,
      },
    });
  },

  /**
   * Trả về phản hồi lỗi theo envelope API.md §1.1
   */
  error(res, errorCode = 'INTERNAL_ERROR', message = 'Đã có lỗi xảy ra', data = null, statusCode = 500) {
    return res.status(statusCode).json({
      code: errorCode,
      message,
      data,
    });
  },
};

module.exports = ApiResponse;
