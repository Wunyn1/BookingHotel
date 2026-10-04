import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES, STAFF_ROLES } from '../constants/roles';
import RoleRoute from './RoleRoute';
import SiteLayout from '../layouts/SiteLayout';
import AdminLayout from '../layouts/AdminLayout';
import HomePage from '../features/hotel/pages/HomePage';
import BookingPage from '../features/hotel/pages/BookingPage';
import CustomerBookingsPage from '../features/hotel/pages/CustomerBookingsPage';
import AdminDashboardPage from '../features/hotel/pages/AdminDashboardPage';
import RoomsPage from '../features/hotel/pages/RoomsPage';
import FrontDeskPage from '../features/hotel/pages/FrontDeskPage';
import HousekeepingPage from '../features/hotel/pages/HousekeepingPage';
import ManagementPage from '../features/hotel/pages/ManagementPage';
import RoomTypeDetailPage from '../features/hotel/pages/RoomTypeDetailPage';
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import ChangePasswordPage from '../features/auth/pages/ChangePasswordPage';
import NotFoundPage from '../features/auth/pages/NotFoundPage';
import ForbiddenPage from '../features/auth/pages/ForbiddenPage';

function Root() { const { isAuthenticated, user } = useAuth(); return isAuthenticated && STAFF_ROLES.includes(user.role) ? <Navigate to="/admin/dashboard" replace /> : <HomePage />; }
export default function AppRoutes() {
  return <Routes>
    <Route element={<SiteLayout />}><Route path="/" element={<Root />} /><Route path="/booking" element={<BookingPage />} /><Route path="/room-types/:id" element={<RoomTypeDetailPage />} /></Route>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<RoleRoute allowed={[ROLES.CUSTOMER]}><SiteLayout /></RoleRoute>}><Route path="/my-bookings" element={<CustomerBookingsPage />} /></Route>
    <Route element={<RoleRoute allowed={[ROLES.CUSTOMER]}><SiteLayout /></RoleRoute>}><Route path="/change-password" element={<ChangePasswordPage />} /></Route>
    <Route element={<RoleRoute allowed={STAFF_ROLES}><AdminLayout /></RoleRoute>}><Route path="/admin/dashboard" element={<AdminDashboardPage />} /><Route path="/admin/rooms" element={<RoomsPage />} /><Route path="/admin/front-desk" element={<FrontDeskPage />} /><Route path="/admin/housekeeping" element={<HousekeepingPage />} /><Route path="/admin/management" element={<ManagementPage />} /><Route path="/admin/change-password" element={<ChangePasswordPage />} /></Route>
    <Route path="/403" element={<ForbiddenPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
