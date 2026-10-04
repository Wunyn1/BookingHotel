import { useEffect, useState } from 'react';
import { Card, Select, Table, Tag, Typography } from 'antd';
import { hotelApi } from '../api/hotel.api';

const ROOM_STATUS = { available: ['Trống', 'green'], ready: ['Sẵn sàng', 'cyan'], reserved: ['Đã đặt', 'gold'], occupied: ['Đang có khách', 'red'], dirty: ['Chờ dọn', 'orange'], cleaning: ['Đang dọn', 'purple'], maintenance: ['Bảo trì', 'default'] };
export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const load = () => hotelApi.getRooms().then(setRooms);
  useEffect(() => { load(); }, []);
  const change = async (id, status) => { await hotelApi.updateRoomStatus(id, status); load(); };
  return <div className="content-wrap"><Typography.Title level={2}>Sơ đồ phòng</Typography.Title><Card><Table rowKey="id" dataSource={rooms} columns={[{ title: 'Số phòng', dataIndex: 'roomNumber' }, { title: 'Loại phòng', dataIndex: 'roomTypeName' }, { title: 'Tầng', dataIndex: 'floor' }, { title: 'Trạng thái', dataIndex: 'status', render: (status) => <Tag color={ROOM_STATUS[status]?.[1]}>{ROOM_STATUS[status]?.[0] || 'Không xác định'}</Tag> }, { title: 'Cập nhật trạng thái', render: (_, row) => <Select value={row.status} style={{ width: 160 }} onChange={(value) => change(row.id, value)} options={['available', 'ready', 'cleaning', 'maintenance'].map((value) => ({ value, label: ROOM_STATUS[value][0] }))} /> }]} /></Card></div>;
}
