/**
 * Controller cho Module Auth.
 * Tiếp nhận request HTTP, gọi service và trả về ApiResponse envelope chuẩn.
 */

const authService = require('./auth.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.success(res, result, 'Đăng ký tài khoản thành công', 201);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.success(res, result, 'Đăng nhập thành công');
});

const logout = asyncHandler(async (req, res) => {
  // Client tự hủy JWT lưu trong localStorage/cookie
  return ApiResponse.success(res, null, 'Đăng xuất thành công');
});

const getMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user.id);
  return ApiResponse.success(res, result, 'Lấy thông tin tài khoản thành công');
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  return ApiResponse.success(res, null, 'Đổi mật khẩu thành công');
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.params.id, req.user.role, req.user.id);
  return ApiResponse.success(res, result, 'Đã đặt lại mật khẩu');
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  changePassword,
  resetPassword,
};
