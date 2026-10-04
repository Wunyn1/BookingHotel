import { Layout, Button, Avatar, Dropdown, Space } from 'antd';
import { CalendarOutlined, LoginOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../constants/roles';

const { Header, Content, Footer } = Layout;
export default function SiteLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <Layout className="site-shell">
      <Header className="site-header">
        <div className="brand" onClick={() => navigate('/')}>
          <span className="brand-mark">A</span>
          <span><b>AURORA</b><small>HOTEL BOOKING</small></span>
        </div>
        <Space>
          {isAuthenticated && user.role === 'customer' && <Button type="text" icon={<CalendarOutlined />} onClick={() => navigate('/my-bookings')}>Đơn của tôi</Button>}
          {!isAuthenticated ? <Space><Button type="text" onClick={() => navigate('/register')}>Đăng ký</Button><Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/login')}>Đăng nhập</Button></Space> : (
            <Dropdown menu={{ items: [
              { key: 'role', label: ROLE_LABEL[user.role], disabled: true },
              { key: 'password', icon: <UserOutlined />, label: 'Đổi mật khẩu', onClick: () => navigate('/change-password') },
              { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: async () => { await logout(); navigate('/'); } },
            ] }}>
              <Button type="text"><Avatar size="small" icon={<UserOutlined />} /> {user.fullName}</Button>
            </Dropdown>
          )}
        </Space>
      </Header>
      <Content><Outlet /></Content>
      <Footer className="site-footer">© 2026 Aurora Hotel · Đặt phòng trực tiếp, minh bạch và thuận tiện</Footer>
    </Layout>
  );
}
