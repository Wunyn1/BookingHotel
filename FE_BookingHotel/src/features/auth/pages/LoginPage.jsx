import { useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { safeRedirectPath } from '../../../routes/paths';
import { getErrorMessage } from '../../../lib/axiosClient';

const { Title, Text } = Typography;
export default function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async ({ email, password }) => { setLoading(true); setError(''); try { const user = await login(email.trim(), password); navigate(safeRedirectPath(user.role, location.state?.from)); } catch (err) { setError(getErrorMessage(err, 'Đăng nhập thất bại')); } finally { setLoading(false); } };
  return <div className="auth-page"><div className="auth-visual"><span className="brand-mark large">A</span><Title>Đặt phòng theo cách<br /><span>của bạn.</span></Title><Text>Trải nghiệm lưu trú tinh tế, đặt phòng nhanh chóng và quản lý kỳ nghỉ dễ dàng.</Text></div><Card className="auth-card"><div className="brand-inline"><span className="brand-mark">A</span><b>AURORA HOTEL</b></div><Title level={2}>Chào mừng trở lại</Title><Text type="secondary">Đăng nhập để quản lý đặt phòng của bạn</Text>{error && <Alert style={{ marginTop: 20 }} type="error" showIcon message={error} />}<Form layout="vertical" onFinish={submit} style={{ marginTop: 24 }}><Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}><Input size="large" prefix={<MailOutlined />} placeholder="name@example.com" /></Form.Item><Form.Item label="Mật khẩu" name="password" rules={[{ required: true }]}><Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" /></Form.Item><Button type="primary" size="large" block htmlType="submit" loading={loading}>Đăng nhập</Button></Form><div className="login-hint">Chưa có tài khoản? <Link to="/register">Đăng ký khách hàng</Link></div><Divider plain>tài khoản demo</Divider><div className="demo-accounts"><Button onClick={() => navigate('/')} block>Khách hàng: customer@hotel.local / Customer@123</Button><Button onClick={() => navigate('/')} block>Lễ tân: reception@hotel.local / Staff@123</Button></div><Text type="secondary" className="login-hint">Tài khoản quản trị: admin@hotel.local / Admin@123</Text></Card></div>;
}
