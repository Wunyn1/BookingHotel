import axiosClient from '../../../lib/axiosClient';
import { mockHotel } from '../../../mocks/mockApi';
import { USE_MOCK } from '../../../lib/env';

const call = (mock, url, options) => USE_MOCK ? mock(options) : axiosClient.get(url, options);
const dataOf = (response) => response?.data?.data ?? response?.data;

export const hotelApi = {
  getRoomTypes: async (query = {}) => dataOf(await call(mockHotel.getRoomTypes, '/hotel/room-types', { params: query })),
  getRoomType: async (id, query = {}) => dataOf(await call((params) => mockHotel.getRoomType(id, params), '/hotel/room-types/' + id, { params: query })),
  createBooking: async (payload) => dataOf(await (USE_MOCK ? mockHotel.createBooking(payload) : axiosClient.post('/hotel/bookings', payload))),
  createHold: async (payload) => dataOf(await axiosClient.post('/hotel/holds', payload)),
  confirmSandboxPayment: async (id) => dataOf(await axiosClient.post('/hotel/payments/' + id + '/sandbox-success')),
  failSandboxPayment: async (id) => dataOf(await axiosClient.post('/hotel/payments/' + id + '/sandbox-fail')),
  getBookings: async () => dataOf(await (USE_MOCK ? mockHotel.getBookings() : axiosClient.get('/hotel/bookings'))),
  getBooking: async (id) => dataOf(await axiosClient.get('/hotel/bookings/' + id)),
  resendConfirmationEmail: async (id) => dataOf(await axiosClient.post('/hotel/bookings/' + id + '/confirmation-email')),
  cancelBooking: async (id) => dataOf(await (USE_MOCK ? mockHotel.cancelBooking(id) : axiosClient.patch('/hotel/bookings/' + id + '/cancel'))),
  createReview: async (payload) => dataOf(await axiosClient.post('/hotel/reviews', payload)),
  getDashboard: async () => dataOf(await (USE_MOCK ? mockHotel.getDashboard() : axiosClient.get('/hotel/dashboard'))),
  getRooms: async () => dataOf(await (USE_MOCK ? mockHotel.getRooms() : axiosClient.get('/hotel/rooms'))),
  updateRoomStatus: async (id, status) => dataOf(await (USE_MOCK ? mockHotel.updateRoomStatus(id, status) : axiosClient.patch('/hotel/rooms/' + id + '/status', { status }))),
  lookupStaffBooking: async (value) => dataOf(await axiosClient.get('/hotel/frontdesk/lookup', { params: { value } })),
  checkIn: async (id, payload) => dataOf(await axiosClient.post('/hotel/bookings/' + id + '/check-in', payload)),
  getServices: async () => dataOf(await axiosClient.get('/hotel/services')),
  getBookingServices: async (id) => dataOf(await axiosClient.get('/hotel/bookings/' + id + '/services')),
  addService: async (id, payload) => dataOf(await axiosClient.post('/hotel/bookings/' + id + '/services', payload)),
  checkout: async (id, payload) => dataOf(await axiosClient.post('/hotel/bookings/' + id + '/check-out', payload)),
  getHousekeepingTasks: async (status) => dataOf(await axiosClient.get('/hotel/housekeeping/tasks', { params: status ? { status } : {} })),
  updateHousekeepingTask: async (id, status) => dataOf(await axiosClient.patch('/hotel/housekeeping/tasks/' + id, { status })),
  getAnalytics: async () => dataOf(await axiosClient.get('/hotel/analytics')),
  getManagementRoomTypes: async () => dataOf(await axiosClient.get('/hotel/management/room-types')),
  createRoomType: async (payload) => dataOf(await axiosClient.post('/hotel/management/room-types', payload)),
  updateRoomType: async (id, payload) => dataOf(await axiosClient.patch('/hotel/management/room-types/' + id, payload)),
  deleteRoomType: async (id) => dataOf(await axiosClient.delete('/hotel/management/room-types/' + id)),
  getManagementRooms: async () => dataOf(await axiosClient.get('/hotel/management/rooms')),
  createRoom: async (payload) => dataOf(await axiosClient.post('/hotel/management/rooms', payload)),
  updateRoom: async (id, payload) => dataOf(await axiosClient.patch('/hotel/management/rooms/' + id, payload)),
  deleteRoom: async (id) => dataOf(await axiosClient.delete('/hotel/management/rooms/' + id)),
  createDailyRate: async (payload) => dataOf(await axiosClient.post('/hotel/management/rates', payload)),
  getDailyRates: async (roomTypeId) => dataOf(await axiosClient.get('/hotel/management/rates', { params: roomTypeId ? { roomTypeId } : {} })),
  getCoupons: async () => dataOf(await axiosClient.get('/hotel/management/coupons')),
  createCoupon: async (payload) => dataOf(await axiosClient.post('/hotel/management/coupons', payload)),
};
