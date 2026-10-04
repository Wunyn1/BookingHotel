import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { safeRedirectPath } from '../../../routes/paths';
import { getErrorMessage } from '../../../lib/axiosClient';

const { Title, Text } = Typography;
export default function RegisterPage() {
  const { register } = useAuth(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (values) => {
    setLoading(true); setError('');
    try { const user = await register(values); navigate(safeRedirectPath(user.role)); }
    catch (err) { setError(getErrorMessage(err, 'Đăng ký thất bại')); }
    finally { setLoading(false); }
  };
  return <div className="auth-page"><div className="auth-visual"><span className="brand-mark large">A</span><Title>Tạo tài khoản<br /><span>cho kỳ nghỉ.</span></Title><Text>Lưu lịch sử đặt phòng, nhận xác nhận nhanh và quản lý chuyến đi dễ dàng.</Text></div><Card className="auth-card"><div className="brand-inline"><span className="brand-mark">A</span><b>AURORA HOTEL</b></div><Title level={2}>Đăng ký tài khoản</Title><Text type="secondary">Tạo tài khoản khách hàng miễn phí</Text>{error && <Alert style={{ marginTop: 20 }} type="error" showIcon message={error} />}<Form layout="vertical" onFinish={submit} style={{ marginTop: 24 }}><Form.Item label="Họ và tên" name="fullName" rules={[{ required: true, min: 2, message: 'Vui lòng nhập họ và tên' }]}><Input size="large" prefix={<UserOutlined />} placeholder="Nguyễn Văn A" /></Form.Item><Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]}><Input size="large" prefix={<MailOutlined />} placeholder="name@example.com" /></Form.Item><Form.Item label="Mật khẩu" name="password" rules={[{ required: true, min: 8, pattern: /^(?=.*[A-Za-z])(?=.*\d)/, message: 'Mật khẩu từ 8 ký tự, gồm chữ và số' }]}><Input.Password size="large" prefix={<LockOutlined />} placeholder="Ít nhất 8 ký tự" /></Form.Item><Form.Item label="Xác nhận mật khẩu" name="confirmPassword" dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Mật khẩu xác nhận không khớp')); } })]}><Input.Password size="large" prefix={<LockOutlined />} /></Form.Item><Button type="primary" size="large" block htmlType="submit" loading={loading}>Tạo tài khoản</Button></Form><div className="login-hint">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></div></Card></div>;
}
