export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  RECEPTIONIST: 'receptionist',
  HOUSEKEEPING: 'housekeeping',
  CUSTOMER: 'customer',
};
export const ROLE_LABEL = {
  admin: 'Quản trị viên',
  manager: 'Quản lý khách sạn',
  receptionist: 'Lễ tân',
  housekeeping: 'Buồng phòng',
  customer: 'Khách hàng',
};
export const STAFF_ROLES = [ROLES.ADMIN, ROLES.MANAGER, ROLES.RECEPTIONIST, ROLES.HOUSEKEEPING];
export const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.MANAGER];
