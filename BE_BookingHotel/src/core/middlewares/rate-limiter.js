/**
 * Middleware giới hạn tần suất request (Rate Limiting) theo FR-05.
 * Phòng chống tấn công dò mật khẩu (brute-force) trên endpoint đăng nhập.
 */

const ApiError = require('../errors/api-error');

const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 phút
  max = 10, // Tối đa 10 lần trong 15 phút
  message = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút',
} = {}) => {
  const hits = new Map();

  // Dọn dẹp các bản ghi quá hạn mỗi 5 phút
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now - record.startTime > windowMs) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Không chặn process exit
  if (interval.unref) interval.unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const key = `${ip}_${req.baseUrl || ''}${req.path || ''}`;
    const now = Date.now();

    const record = hits.get(key) || { count: 0, startTime: now };

    if (now - record.startTime > windowMs) {
      record.count = 1;
      record.startTime = now;
    } else {
      record.count += 1;
    }

    hits.set(key, record);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));

    if (record.count > max) {
      return next(new ApiError(429, 'TOO_MANY_REQUESTS', message));
    }

    next();
  };
};

module.exports = createRateLimiter;
