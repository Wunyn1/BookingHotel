import { Result, Button, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ROLE_LABEL } from '../../../constants/roles';
import { homePathOf } from '../../../routes/paths';

const { Text } = Typography;

/** SCR-04 Không có quyền truy cập */
export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const switchAccount = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Result
      status="403"
      title="403"
      subTitle={(
        <>
          Bạn không có quyền truy cập trang này.
          {user && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">Đang đăng nhập: <Text strong>{user.email}</Text> ({ROLE_LABEL[user.role] ?? user.role})</Text>
            </div>
          )}
        </>
      )}
      extra={(
        <Space>
          {user && <Button type="primary" onClick={() => navigate(homePathOf(user.role), { replace: true })}>Về trang chủ</Button>}
          <Button onClick={switchAccount}>{user ? 'Đăng nhập tài khoản khác' : 'Đăng nhập'}</Button>
        </Space>
      )}
    />
  );
}
