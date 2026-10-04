import { useEffect, useState } from 'react';
import { Card, Select, Table, Tag, Typography } from 'antd';
import { hotelApi } from '../api/hotel.api';

const TASK_STATUS = { dirty: ['Chờ dọn', 'red'], assigned: ['Đã phân công', 'orange'], cleaning: ['Đang dọn', 'purple'], ready: ['Đã sẵn sàng', 'green'], cancelled: ['Đã hủy', 'default'] };
const PRIORITY = { low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp' };
export default function HousekeepingPage() {
  const [tasks, setTasks] = useState([]); const load = () => hotelApi.getHousekeepingTasks().then(setTasks);
  useEffect(() => { load(); }, []);
  const change = async (id, status) => { await hotelApi.updateHousekeepingTask(id, status); load(); };
  return <div className="content-wrap"><Typography.Title level={2}>Công việc dọn phòng</Typography.Title><Card><Table rowKey="id" dataSource={tasks} columns={[{ title: 'Số phòng', dataIndex: 'roomNumber' }, { title: 'Tầng', dataIndex: 'floor' }, { title: 'Đơn đặt phòng', dataIndex: 'bookingId' }, { title: 'Mức ưu tiên', dataIndex: 'priority', render: (value) => PRIORITY[value] || value }, { title: 'Trạng thái', dataIndex: 'status', render: (value) => <Tag color={TASK_STATUS[value]?.[1]}>{TASK_STATUS[value]?.[0] || value}</Tag> }, { title: 'Cập nhật', render: (_, row) => <Select value={row.status} style={{ width: 150 }} onChange={(value) => change(row.id, value)} options={Object.entries(TASK_STATUS).map(([value, label]) => ({ value, label: label[0] }))} /> }]} /></Card></div>;
}
