/**
 * Module Logger cơ bản cho hệ thống Hotel Booking.
 * Đảm bảo che giấu thông tin nhạy cảm (password, token, secret) theo 07 §5.1.
 */

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'temporaryPassword', 'passwordHash'];

function sanitize(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const clean = { ...data };
  for (const key of Object.keys(clean)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      clean[key] = '***REDACTED***';
    } else if (typeof clean[key] === 'object') {
      clean[key] = sanitize(clean[key]);
    }
  }
  return clean;
}

const formatTimestamp = () => new Date().toISOString();

const logger = {
  info(message, meta = {}) {
    console.log(`[${formatTimestamp()}] [INFO] ${message}`, Object.keys(meta).length ? sanitize(meta) : '');
  },

  warn(message, meta = {}) {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, Object.keys(meta).length ? sanitize(meta) : '');
  },

  error(message, error = null) {
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : sanitize(error);
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, errorDetails || '');
  },

  audit(userId, action, target, targetId = null, extra = {}) {
    // Nhật ký nghiệp vụ quan trọng phục vụ đối soát
    console.log(
      `[${formatTimestamp()}] [AUDIT] Người dùng [${userId}] thực hiện [${action}] trên [${target}:${targetId || 'N/A'}]`,
      sanitize(extra)
    );
  },
};

module.exports = logger;
