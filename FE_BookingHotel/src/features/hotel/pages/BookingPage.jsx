import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Radio, Result, Row, Typography } from 'antd';
import { CheckCircleOutlined, LockOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { hotelApi } from '../api/hotel.api';
import { useAuth } from '../../../context/AuthContext';

const { Title, Text } = Typography;

export default function BookingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const roomTypeId = params.get('roomTypeId') || '1';
  const checkIn = params.get('checkIn') || '';
  const checkOut = params.get('checkOut') || '';
  const requestedRoomCount = Number(params.get('roomCount') || 1);

  const confirmSandboxPayment = async () => {
    setPaying(true);
    setError('');
    try {
      const result = await hotelApi.confirmSandboxPayment(payment.id);
      setPayment(result);
      setBooking((current) => ({ ...current, status: 'confirmed', paymentStatus: 'success', confirmationEmail: result.confirmationEmail }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Thanh toán thất bại');
    } finally {
      setPaying(false);
    }
  };

  const submit = async (values) => {
    setError('');
    if (values.paymentMethod !== 'pay_at_hotel' && !user) {
      setError('Vui lòng đăng nhập trước khi thanh toán online để bảo vệ giao dịch.');
      return;
    }
    try {
      const hold = await hotelApi.createHold({ roomTypeId: Number(roomTypeId), checkIn, checkOut, roomCount: Number(values.roomCount || requestedRoomCount), adults: values.adults, children: values.children });
      const created = await hotelApi.createBooking({ ...values, roomTypeId: Number(roomTypeId), checkIn, checkOut, roomCount: Number(values.roomCount || requestedRoomCount), holdToken: hold.holdToken });
      setBooking(created);
      setPayment(created.payment || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Đặt phòng thất bại');
    }
  };

  if (booking) return <Result icon={<CheckCircleOutlined style={{ color: '#3d8069' }} />} status="success" title={booking.status === 'confirmed' ? 'Đặt phòng thành công' : 'Đã tạo đơn, chờ thanh toán'} subTitle={'Mã đặt phòng của bạn: ' + booking.bookingCode} extra={<>
    {booking.status === 'confirmed' && booking.confirmationEmail?.sent && <Alert type="success" showIcon message="Email xác nhận kèm mã QR đã được gửi đến email của bạn." />}
    {booking.status === 'confirmed' && booking.confirmationEmail?.reason === 'SMTP_NOT_CONFIGURED' && <Alert type="warning" showIcon message="Đơn đặt phòng đã xác nhận. Hệ thống chưa cấu hình SMTP nên chưa gửi được email; hãy cung cấp mã đặt phòng cho lễ tân." />}
    {payment?.status === 'pending' && <Button type="primary" loading={paying} onClick={confirmSandboxPayment}>Thanh toán Sandbox {booking.depositAmount?.toLocaleString('vi-VN')} đ</Button>}
    {error && <Alert type="error" showIcon message={error} />}
    <Button onClick={() => navigate('/my-bookings')}>Xem đơn của tôi</Button><Button onClick={() => navigate('/')}>Về trang chủ</Button>
  </>} />;

  return <div className="content-wrap narrow"><Card className="booking-card">
    <Title level={2}>Hoàn tất đặt phòng</Title>
    <Text type="secondary">Thông tin ngày lưu trú: <b>{checkIn}</b> đến <b>{checkOut}</b></Text>
    {error && <Alert style={{ marginTop: 16 }} type="error" showIcon message={error} />}
    <Form form={form} layout="vertical" onFinish={submit} initialValues={{ guestName: user?.fullName, guestEmail: user?.email, adults: 2, children: 0, roomCount: requestedRoomCount, paymentMethod: 'pay_at_hotel' }} style={{ marginTop: 24 }}>
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item name="guestName" label="Họ và tên người đặt" rules={[{ required: true }]}><Input placeholder="Nguyễn Văn A" /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="guestPhone" label="Số điện thoại" rules={[{ required: true }]}><Input placeholder="0901 234 567" /></Form.Item></Col>
        <Col xs={24}><Form.Item name="guestEmail" label="Email nhận xác nhận" rules={[{ required: true, type: 'email' }]}><Input placeholder="you@example.com" /></Form.Item></Col>
        <Col xs={8}><Form.Item name="adults" label="Người lớn"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={8}><Form.Item name="children" label="Trẻ em"><InputNumber min={0} max={10} style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={8}><Form.Item name="roomCount" label="Số phòng"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={24}><Form.Item name="paymentMethod" label="Phương thức thanh toán"><Radio.Group options={[
          { value: 'pay_at_hotel', label: 'Thanh toán tại khách sạn' },
          { value: 'vietqr', label: 'Đặt cọc 30% qua VietQR' },
          { value: 'momo', label: 'Ví MoMo Sandbox' },
          { value: 'vnpay', label: 'VNPay Sandbox' },
          { value: 'card', label: 'Thẻ Visa/Mastercard Sandbox' },
          { value: 'bank_transfer', label: 'Chuyển khoản Sandbox' },
        ]} /></Form.Item></Col>
        <Col xs={24}><Form.Item noStyle shouldUpdate={(previous, current) => previous.paymentMethod !== current.paymentMethod}>{({ getFieldValue }) => {
          const method = getFieldValue('paymentMethod');
          if (method === 'card') return <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="cardNumber" label="Số thẻ" rules={[{ required: true }]}><Input placeholder="4111 1111 1111 1111" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="cardName" label="Tên trên thẻ" rules={[{ required: true }]}><Input placeholder="NGUYEN VAN A" /></Form.Item></Col>
            <Col xs={12}><Form.Item name="cardExpiry" label="Ngày hết hạn" rules={[{ required: true }]}><Input placeholder="MM/YY" /></Form.Item></Col>
            <Col xs={12}><Form.Item name="cardCvv" label="CVV" rules={[{ required: true }]}><Input.Password placeholder="123" /></Form.Item></Col>
          </Row>;
          if (method !== 'pay_at_hotel') return <Alert type="info" showIcon message="Môi trường demo sử dụng Sandbox Payment. Sau khi tạo đơn, bấm nút thanh toán để xác nhận giao dịch." />;
          return null;
        }}</Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="couponCode" label="Mã giảm giá"><Input placeholder="AURORA10" /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="specialRequest" label="Yêu cầu đặc biệt"><Input placeholder="Phòng tầng cao, giường phụ..." /></Form.Item></Col>
      </Row>
      <Button type="primary" size="large" block htmlType="submit" icon={<LockOutlined />}>Xác nhận đặt phòng</Button>
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>Phòng được giữ tối đa 15 phút trong quá trình thanh toán.</Text>
    </Form>
  </Card></div>;
}
