import { ROLES } from '../constants/roles';
export const homePathOf = (role) => role === ROLES.CUSTOMER ? '/' : '/admin/dashboard';
export const changePasswordPathOf = () => '/change-password';
export const safeRedirectPath = (role, from) => (typeof from === 'string' && from.startsWith(role === ROLES.CUSTOMER ? '/' : '/admin/') && from !== '/login' ? from : homePathOf(role));
