import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import { DashboardOutlined, HomeOutlined, LogoutOutlined, UserOutlined, LoginOutlined, ClearOutlined, SettingOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../constants/roles';

const { Header, Sider, Content } = Layout;
export default function AdminLayout() {
  const navigate = useNavigate(); const location = useLocation(); const { user, logout } = useAuth();
  const menu = [
    { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
    { key: '/admin/front-desk', icon: <LoginOutlined />, label: 'Quầy lễ tân' },
    { key: '/admin/rooms', icon: <HomeOutlined />, label: 'Sơ đồ phòng' },
    { key: '/admin/housekeeping', icon: <ClearOutlined />, label: 'Dọn phòng' },
    ...(user.role === 'admin' || user.role === 'manager' ? [{ key: '/admin/management', icon: <SettingOutlined />, label: 'Giá & khuyến mãi' }] : []),
  ];
  return <Layout style={{ minHeight: '100vh' }}><Header className="admin-header"><div className="admin-brand"><span className="brand-mark">A</span><b>AURORA HOTEL</b></div><Dropdown menu={{ items: [{ key: 'role', label: ROLE_LABEL[user.role], disabled: true }, { key: 'password', icon: <UserOutlined />, label: 'Đổi mật khẩu', onClick: () => navigate('/admin/change-password') }, { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: async () => { await logout(); navigate('/'); } }] }}><Button type="text"><Avatar size="small" icon={<UserOutlined />} /> {user.fullName}</Button></Dropdown></Header><Layout><Sider breakpoint="lg" collapsedWidth="0" theme="light"><Menu mode="inline" selectedKeys={[location.pathname]} items={menu} onClick={({ key }) => navigate(key)} /></Sider><Content><Outlet /></Content></Layout></Layout>;
}
