import axios from 'axios';
import { API_BASE_URL } from './env';
import { authStorage } from './authStorage';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Gắn JWT vào mọi request
axiosClient.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token hết hạn -> xóa và về trang đăng nhập.
// v1 dùng 1 token hạn 7 ngày, không có refresh token (SRS FR-08).
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authStorage.clear();
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default axiosClient;

/**
 * Envelope của backend: { code, message, data }  — xem API.md mục 1.1
 * Lấy thông báo lỗi thân thiện (backend trả message bằng tiếng Việt).
 */
export const getErrorMessage = (error, fallback = 'Có lỗi xảy ra, vui lòng thử lại') => {
  if (error?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ';
  return error?.response?.data?.message || fallback;
};

/** Mã lỗi ổn định để xử lý theo từng trường hợp, VD: 'BED_NOT_AVAILABLE' */
export const getErrorCode = (error) => error?.response?.data?.code || null;

/** Lỗi theo từng trường để đổ vào Form của antd — API.md mục 1.1 */
export const getFieldErrors = (error) => error?.response?.data?.data?.errors || null;
