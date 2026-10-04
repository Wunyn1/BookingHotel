const ApiError = require('../errors/api-error');
const { verifyToken } = require('../utils/jwt');
const asyncHandler = require('../utils/async-handler');
const { pool } = require('../config/database');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập');
  let payload; try { payload = verifyToken(header.slice(7)); } catch { throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'); }
  const user = (await pool.query('SELECT id,email,full_name,role,is_active,must_change_password FROM users WHERE id=$1', [payload.userId || payload.id])).rows[0];
  if (!user || user.is_active === false) throw new ApiError(401, 'UNAUTHORIZED', 'Tài khoản không tồn tại hoặc đã bị khóa');
  req.user = { id: String(user.id), email: user.email, fullName: user.full_name, role: user.role, mustChangePassword: Boolean(user.must_change_password) }; next();
});
const optionalAuthenticate = (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next();
const authorize = (...roles) => (req, res, next) => { if (!req.user) return next(new ApiError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập')); if (!roles.includes(req.user.role)) return next(new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này')); next(); };
module.exports = { authenticate, optionalAuthenticate, authorize };
