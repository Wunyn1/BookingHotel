import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../../lib/authApi';
import { useAuth } from '../../../context/AuthContext';
import { getErrorMessage } from '../../../lib/axiosClient';

export default function ChangePasswordPage() {
  const navigate = useNavigate(); const { updateUser, user } = useAuth();
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async ({ oldPassword, newPassword }) => {
    setLoading(true); setError('');
    try { const result = await authApi.changePassword({ oldPassword, newPassword }); updateUser({ mustChangePassword: false }); navigate(user.role === 'customer' ? '/my-bookings' : '/admin/dashboard'); return result; }
    catch (err) { setError(getErrorMessage(err, 'Không thể đổi mật khẩu')); }
    finally { setLoading(false); }
  };
  return <div className="content-wrap narrow"><Card className="booking-card"><Typography.Title level={2}>Đổi mật khẩu</Typography.Title><Typography.Text type="secondary">Bảo vệ tài khoản bằng mật khẩu mới.</Typography.Text>{error && <Alert style={{ marginTop: 16 }} type="error" showIcon message={error} />}<Form layout="vertical" onFinish={submit} style={{ marginTop: 24 }}><Form.Item label="Mật khẩu hiện tại" name="oldPassword" rules={[{ required: true }]}><Input.Password prefix={<LockOutlined />} /></Form.Item><Form.Item label="Mật khẩu mới" name="newPassword" rules={[{ required: true, min: 8, pattern: /^(?=.*[A-Za-z])(?=.*\d)/, message: 'Mật khẩu từ 8 ký tự, gồm chữ và số' }]}><Input.Password prefix={<LockOutlined />} /></Form.Item><Form.Item label="Nhập lại mật khẩu mới" name="confirmPassword" dependencies={['newPassword']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('Mật khẩu xác nhận không khớp')); } })]}><Input.Password prefix={<LockOutlined />} /></Form.Item><Button type="primary" htmlType="submit" loading={loading}>Lưu mật khẩu mới</Button></Form></Card></div>;
}
