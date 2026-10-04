import { useEffect, useState } from 'react';
import { Button, Card, Col, Rate, Row, Tag, Typography } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { hotelApi } from '../api/hotel.api';
import { formatCurrency } from '../../../utils/formatter';
const { Title, Text, Paragraph } = Typography;
export default function RoomTypeDetailPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const navigate = useNavigate(); const [room, setRoom] = useState(null);
  useEffect(() => { hotelApi.getRoomType(id, Object.fromEntries(params.entries())).then(setRoom); }, [id, params]);
  if (!room) return <div className="content-wrap"><Card loading /></div>;
  const checkIn = params.get('checkIn') || ''; const checkOut = params.get('checkOut') || '';
  return <div className="content-wrap narrow"><Card><div className={'room-photo room-' + room.code.toLowerCase()}><span>{room.name}</span></div><Title level={2}>{room.name}</Title><Paragraph>{room.description}</Paragraph><Row gutter={[16, 16]}><Col span={12}><Text strong>Diện tích</Text><div>{room.areaM2} m²</div></Col><Col span={12}><Text strong>Sức chứa</Text><div>{room.capacity} khách</div></Col><Col span={12}><Text strong>Giường</Text><div>{room.bedType}</div></Col><Col span={12}><Text strong>Đánh giá</Text><div><Rate disabled value={room.rating} /> ({room.reviewCount})</div></Col></Row><div className="amenities">{room.amenities.map((item) => <Tag key={item}>{item}</Tag>)}</div><Title level={4}>{formatCurrency(room.basePrice)} / đêm</Title><Button type="primary" onClick={() => navigate(`/booking?roomTypeId=${room.id}&checkIn=${checkIn}&checkOut=${checkOut}`)}>Đặt phòng</Button></Card></div>;
}
