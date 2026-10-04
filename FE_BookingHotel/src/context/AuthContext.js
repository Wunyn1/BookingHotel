import { createContext, useContext } from 'react';

/**
 * Context chứa trạng thái đăng nhập.
 * Tách riêng khỏi AuthProvider.jsx để file này không export component,
 * nhờ vậy Fast Refresh của Vite hoạt động đúng.
 */
export const AuthContext = createContext(null);

/**
 * Lấy thông tin người dùng đang đăng nhập.
 * @example const { user, logout, isAuthenticated } = useAuth();
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
};
