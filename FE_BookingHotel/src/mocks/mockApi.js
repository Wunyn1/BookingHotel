import { authStorage } from '../lib/authStorage';

const wait = (value) => new Promise((resolve) => setTimeout(() => resolve({ data: { code: 'OK', data: value } }), 180));
const fail = (message) => { const error = new Error(message); error.response = { data: { message } }; throw error; };
const types = [
  { id: 1, code: 'STD', name: 'Standard', description: 'Phòng tiêu chuẩn, tiện nghi cho kỳ nghỉ ngắn ngày.', areaM2: 24, bedType: '1 giường đôi', capacity: 2, basePrice: 850000, weekendPrice: 950000, amenities: ['Wi-Fi', 'Điều hòa', 'TV', 'Bữa sáng'], totalRooms: 6 },
  { id: 2, code: 'DLX', name: 'Deluxe', description: 'Phòng rộng với cửa sổ lớn và ban công riêng.', areaM2: 32, bedType: '1 giường king', capacity: 2, basePrice: 1250000, weekendPrice: 1450000, amenities: ['Wi-Fi', 'Điều hòa', 'TV', 'Bữa sáng', 'Ban công'], totalRooms: 6 },
  { id: 3, code: 'STE', name: 'Suite', description: 'Không gian cao cấp cho gia đình hoặc nhóm bạn.', areaM2: 55, bedType: '1 king + sofa bed', capacity: 4, basePrice: 2200000, weekendPrice: 2500000, amenities: ['Wi-Fi', 'Điều hòa', 'TV', 'Bữa sáng', 'Ban công', 'Phòng khách'], totalRooms: 3 },
];
const bookings = [];
const accounts = [
  { id: '1', email: 'admin@hotel.local', password: 'Admin@123', fullName: 'Quản trị Hotel', role: 'admin' },
  { id: '2', email: 'reception@hotel.local', password: 'Staff@123', fullName: 'Lễ tân Hotel', role: 'receptionist' },
  { id: '3', email: 'customer@hotel.local', password: 'Customer@123', fullName: 'Khách hàng Demo', role: 'customer' },
];
const currentUser = () => authStorage.getUser();
const isOverlap = (a, b) => a.status !== 'cancelled' && a.checkIn < b.checkOut && a.checkOut > b.checkIn;
const availability = (type, checkIn, checkOut) => {
  const used = bookings.filter((b) => b.roomTypeId === type.id && isOverlap(b, { checkIn, checkOut })).length;
  return Math.max(0, type.totalRooms - used);
};
const withAvailability = (query = {}) => types
  .filter((type) => !query.adults || type.capacity >= Number(query.adults) + Number(query.children || 0))
  .map((type) => ({ ...type, availableRooms: query.checkIn ? availability(type, query.checkIn, query.checkOut) : type.totalRooms }));

export const mockAuth = {
  login: async ({ email, password }) => {
    const found = accounts.find((account) => account.email === email && account.password === password);
    if (!found) fail('Email hoặc mật khẩu không chính xác');
    const user = { id: found.id, email: found.email, fullName: found.fullName, role: found.role, mustChangePassword: false };
    return wait({ token: 'mock-' + found.id, user });
  },
  register: async ({ email, password, fullName }) => {
    const user = { id: 'u-' + Date.now(), email, fullName, role: 'customer', mustChangePassword: false };
    accounts.push({ ...user, password });
    return wait({ token: 'mock-' + user.id, user });
  },
  changePassword: async () => wait(null),
};

export const mockHotel = {
  getRoomTypes: async (query) => wait(withAvailability(query)),
  getRoomType: async (id, query) => wait(withAvailability(query).find((type) => String(type.id) === String(id))),
  createBooking: async (body) => {
    const type = types.find((item) => item.id === Number(body.roomTypeId));
    if (!type || availability(type, body.checkIn, body.checkOut) < 1) fail('Phòng đã được đặt trong khoảng thời gian này');
    const nights = Math.max(1, Math.ceil((new Date(body.checkOut) - new Date(body.checkIn)) / 86400000));
    const booking = {
      id: 'b-' + Date.now(), bookingCode: 'HTL' + Date.now().toString(36).toUpperCase(),
      roomTypeId: type.id, roomTypeName: type.name, roomNumber: type.id + '01', status: 'confirmed', paymentStatus: 'pending',
      paymentMethod: body.paymentMethod || 'pay_at_hotel', guestName: body.guestName, guestEmail: body.guestEmail, guestPhone: body.guestPhone,
      adults: Number(body.adults || 1), children: Number(body.children || 0), checkIn: body.checkIn, checkOut: body.checkOut, nights,
      totalAmount: type.basePrice * nights, depositAmount: body.paymentMethod === 'pay_at_hotel' ? 0 : type.basePrice * nights * 0.3, userId: currentUser()?.id,
    };
    bookings.unshift(booking);
    return wait(booking);
  },
  getBookings: async () => {
    const user = currentUser();
    return wait(bookings.filter((booking) => !user || booking.userId === user.id || ['admin', 'manager', 'receptionist', 'housekeeping'].includes(user.role)));
  },
  cancelBooking: async (id) => {
    const booking = bookings.find((item) => item.id === id);
    if (!booking) fail('Không tìm thấy đơn đặt phòng');
    booking.status = 'cancelled';
    return wait(booking);
  },
  getDashboard: async () => wait({
    rooms: { total: 15, available: 12, occupied: 2, cleaning: 1, maintenance: 0 },
    bookings: { total: bookings.length + 18, confirmed: bookings.filter((x) => x.status === 'confirmed').length + 10, checked_in: 2, cancelled: bookings.filter((x) => x.status === 'cancelled').length },
    revenue: { total: bookings.reduce((sum, item) => sum + item.totalAmount, 0) + 45600000, thisMonth: bookings.reduce((sum, item) => sum + item.totalAmount, 0) + 12800000 },
    popularRoomTypes: types.map((type) => ({ name: type.name, bookings: type.id === 2 ? 24 : type.id === 1 ? 18 : 9 })),
  }),
  getRooms: async () => wait(types.flatMap((type) => Array.from({ length: type.totalRooms }, (_, index) => ({
    id: type.id + '-' + index, roomNumber: type.id + String(index + 1).padStart(2, '0'), floor: type.id,
    status: index === 1 ? 'occupied' : index === 2 ? 'cleaning' : 'available', roomTypeId: type.id, roomTypeName: type.name, basePrice: type.basePrice,
  })))),
  updateRoomStatus: async (id, status) => wait({ id, status }),
};
