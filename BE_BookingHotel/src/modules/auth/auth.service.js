const bcrypt = require('bcryptjs');
const { pool } = require('../../core/config/database');
const ApiError = require('../../core/errors/api-error');
const { generateToken } = require('../../core/utils/jwt');

const publicUser = (row) => ({ id: row.id, email: row.email, fullName: row.full_name, role: row.role, mustChangePassword: Boolean(row.must_change_password) });
const session = (row) => ({ token: generateToken({ userId: row.id, role: row.role }), expiresIn: 7 * 24 * 60 * 60, user: publicUser(row) });
const register = async ({ email, password, fullName }) => {
  const normalized = email.trim().toLowerCase();
  if ((await pool.query('SELECT id FROM users WHERE email=$1', [normalized])).rowCount) throw new ApiError(409, 'DUPLICATE_EMAIL', 'Email đã được sử dụng');
  const result = await pool.query('INSERT INTO users (email,password_hash,full_name,role) VALUES ($1,$2,$3,$4) RETURNING id,email,full_name,role,must_change_password', [normalized, await bcrypt.hash(password, 10), fullName.trim(), 'customer']);
  return session(result.rows[0]);
};
const login = async ({ email, password }) => {
  const user = (await pool.query('SELECT * FROM users WHERE email=$1', [email.trim().toLowerCase()])).rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác');
  if (!user.is_active) throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
  await pool.query('UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1', [user.id]); return session(user);
};
const getMe = async (userId) => { const row = (await pool.query('SELECT id,email,full_name,role,must_change_password FROM users WHERE id=$1', [userId])).rows[0]; if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản'); return publicUser(row); };
const changePassword = async (userId, { oldPassword, newPassword }) => {
  const row = (await pool.query('SELECT password_hash FROM users WHERE id=$1', [userId])).rows[0];
  if (!row || !(await bcrypt.compare(oldPassword, row.password_hash))) throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác');
  await pool.query('UPDATE users SET password_hash=$1,must_change_password=FALSE,updated_at=NOW() WHERE id=$2', [await bcrypt.hash(newPassword, 10), userId]);
};
module.exports = { register, login, getMe, changePassword };
