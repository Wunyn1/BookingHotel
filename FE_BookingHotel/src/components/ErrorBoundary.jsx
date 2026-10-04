import { Component } from 'react';
import { Result, Button, Typography } from 'antd';

const { Paragraph, Text } = Typography;

/**
 * Bắt lỗi khi render để một component hỏng không làm trắng toàn bộ trang.
 * Bọc quanh <App /> ở main.jsx.
 *
 * React chưa có bản hook cho việc này nên bắt buộc phải dùng class component.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Ở dự án thật, đây là chỗ gửi lỗi về dịch vụ theo dõi.
    // v1 chỉ ghi ra console cho người phát triển đọc.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Result
        status="500"
        title="Đã xảy ra lỗi"
        subTitle="Giao diện gặp sự cố ngoài dự kiến. Vui lòng tải lại trang."
        extra={<Button type="primary" onClick={this.handleReload}>Về trang chủ</Button>}
      >
        {import.meta.env.DEV && (
          <Paragraph>
            <Text type="danger" code style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </Text>
          </Paragraph>
        )}
      </Result>
    );
  }
}
