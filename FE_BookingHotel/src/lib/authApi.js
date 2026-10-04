import axiosClient from './axiosClient';
import { mockAuth } from '../mocks/mockApi';
import { USE_MOCK } from './env';
export const authApi = {
  login: (data) => USE_MOCK ? mockAuth.login(data) : axiosClient.post('/auth/login', data),
  register: (data) => USE_MOCK ? mockAuth.register(data) : axiosClient.post('/auth/register', data),
  logout: () => USE_MOCK ? Promise.resolve() : axiosClient.post('/auth/logout'),
  me: () => axiosClient.get('/auth/me'),
  changePassword: (data) => USE_MOCK ? mockAuth.changePassword(data) : axiosClient.patch('/auth/change-password', data),
};
