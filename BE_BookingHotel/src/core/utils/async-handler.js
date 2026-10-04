/**
 * Wrapper bọc các hàm async controller để tự động chuyển tiếp exception sang error middleware,
 * tránh việc phải dùng try/catch lặp lại ở từng controller (10-QUY-TRINH-LAM-VIEC.md §2.4).
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
