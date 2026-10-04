import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
export default function NotFoundPage() {
  const navigate = useNavigate();
  return <Result status="404" title="404" subTitle="Không tìm thấy trang bạn yêu cầu." extra={<Button type="primary" onClick={() => navigate('/')}>Về trang chủ</Button>} />;
}
