import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Form, InputNumber, Row, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, EnvironmentOutlined, SearchOutlined, StarFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { hotelApi } from '../api/hotel.api';
import { formatCurrency } from '../../../utils/formatter';

const { Title, Text } = Typography;
const initial = { checkIn: dayjs().add(1, 'day'), checkOut: dayjs().add(2, 'day'), adults: 2, children: 0, roomCount: 1 };
export default function HomePage() {
  const routerNavigate = useNavigate();
  const [form] = Form.useForm();
  const navigate = (path) => routerNavigate(path.startsWith('/booking?') && !path.includes('roomCount=') ? `${path}&roomCount=${form.getFieldValue('roomCount') || 1}` : path);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const search = async (values = form.getFieldsValue()) => {
    setError('');
    try {
      const query = { checkIn: values.checkIn.format('YYYY-MM-DD'), checkOut: values.checkOut.format('YYYY-MM-DD'), adults: values.adults, children: values.children, roomCount: values.roomCount };
      setRooms(await hotelApi.getRoomTypes(query));
    } catch (err) { setError(err.response?.data?.message || 'Không thể tải danh sách phòng'); }
  };
  useEffect(() => { let mounted = true; hotelApi.getRoomTypes({ checkIn: initial.checkIn.format('YYYY-MM-DD'), checkOut: initial.checkOut.format('YYYY-MM-DD'), adults: initial.adults, children: initial.children, roomCount: initial.roomCount }).then((data) => mounted && setRooms(data)).catch((err) => mounted && setError(err.response?.data?.message || 'Không thể tải danh sách phòng')); return () => { mounted = false; }; }, []);
  return (
    <div>
      <section className="hero">
        <div className="hero-copy">
          <Tag color="gold">Kỳ nghỉ bắt đầu từ đây</Tag>
          <Title>Không gian nghỉ dưỡng<br /><span>đáng nhớ</span></Title>
          <Text>Khám phá phòng phù hợp, xem giá rõ ràng và hoàn tất đặt phòng chỉ trong vài phút.</Text>
        </div>
        <div className="hero-image"><div className="hero-card"><StarFilled /> 4.9/5 · Hơn 2.000 đánh giá</div></div>
      </section>
      <Card className="search-card">
        <Form form={form} layout="vertical" initialValues={initial} onFinish={search}>
          <Row gutter={[16, 8]} align="bottom">
            <Col xs={24} sm={8} lg={5}><Form.Item name="checkIn" label="Nhận phòng" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs(), 'day')} /></Form.Item></Col>
            <Col xs={24} sm={8} lg={5}><Form.Item name="checkOut" label="Trả phòng" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={4} lg={3}><Form.Item name="adults" label="Người lớn"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={4} lg={3}><Form.Item name="children" label="Trẻ em"><InputNumber min={0} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={4} lg={3}><Form.Item name="roomCount" label="Số phòng"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} lg={6}><Form.Item><Button block type="primary" size="large" icon={<SearchOutlined />} htmlType="submit">Tìm phòng trống</Button></Form.Item></Col>
          </Row>
        </Form>
      </Card>
      <main className="content-wrap">
        <div className="section-heading"><div><Text className="eyebrow">LỰA CHỌN CỦA BẠN</Text><Title level={2}>Phòng & loại phòng</Title></div><Text type="secondary"><EnvironmentOutlined /> Trung tâm thành phố · Nhận phòng từ 14:00</Text></div>
        {error && <Alert type="error" showIcon message={error} />}
        <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
          {rooms.map((room) => <Col xs={24} md={12} xl={8} key={room.id}><Card className="room-card" cover={<div className={'room-photo room-' + room.code.toLowerCase()}><span>{room.name}</span></div>}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}><Title level={3}>{room.name}</Title><Text type="secondary">{room.description}</Text><div className="amenities">{room.amenities.map((item) => <Tag key={item}>{item}</Tag>)}</div><div className="room-meta"><span>Từ <b>{formatCurrency(room.basePrice)}</b> / đêm</span><Text type="secondary">{room.availableRooms} phòng còn trống</Text></div><Button type="primary" block icon={<ArrowRightOutlined />} disabled={!room.availableRooms} onClick={() => navigate('/booking?roomTypeId=' + room.id + '&checkIn=' + form.getFieldValue('checkIn').format('YYYY-MM-DD') + '&checkOut=' + form.getFieldValue('checkOut').format('YYYY-MM-DD'))}>{room.availableRooms ? 'Đặt phòng này' : 'Hết phòng'}</Button></Space>
          </Card></Col>)}
        </Row>
      </main>
    </div>
  );
}
