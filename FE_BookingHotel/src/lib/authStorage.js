/**
 * Nơi DUY NHẤT đọc/ghi phiên đăng nhập trên trình duyệt.
 *
 * "Ghi nhớ đăng nhập":
 *   - có tích   → localStorage   : giữ phiên tới khi JWT hết hạn (7 ngày, FR-08)
 *   - không tích → sessionStorage : đóng trình duyệt là phải đăng nhập lại
 *
 * ⚠️ Không đọc thẳng localStorage.getItem('token') ở nơi khác — sẽ bỏ sót phiên trong sessionStorage.
 */
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const stores = () => [globalThis.localStorage, globalThis.sessionStorage].filter(Boolean);

const safe = (fn, fallback = null) => {
  try { return fn(); } catch { return fallback; }
};

/** Kho đang chứa phiên hiện tại (nếu có) */
const activeStore = () => stores().find((s) => safe(() => s.getItem(TOKEN_KEY)));

export const authStorage = {
  getToken: () => safe(() => activeStore()?.getItem(TOKEN_KEY) ?? null),

  getUser: () => safe(() => JSON.parse(activeStore()?.getItem(USER_KEY) || 'null')),

  save: ({ token, user }, remember = true) => {
    authStorage.clear();
    const store = remember ? globalThis.localStorage : globalThis.sessionStorage;
    safe(() => {
      store.setItem(TOKEN_KEY, token);
      store.setItem(USER_KEY, JSON.stringify(user));
    });
  },

  /** Cập nhật thông tin người dùng trong đúng kho đang dùng (VD sau khi đổi mật khẩu) */
  updateUser: (user) => safe(() => activeStore()?.setItem(USER_KEY, JSON.stringify(user))),

  clear: () => stores().forEach((s) => safe(() => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  })),
};
