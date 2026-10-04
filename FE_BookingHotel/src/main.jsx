import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

import { AuthProvider } from './context/AuthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App.jsx';
import './index.css';

dayjs.locale('vi');

/** Dấu * bắt buộc đặt SAU nhãn, đúng bản thiết kế — áp dụng cho mọi Form */
const requiredMarkAfter = (label, { required }) => (
  <>
    {label}
    {required && <span style={{ color: '#FF4D4F', marginInlineStart: 4 }}>*</span>}
  </>
);

// Bảng màu lấy từ docs/08 mục 4.1
const theme = {
  token: {
    colorPrimary: '#3D8069',
    colorSuccess: '#3D8069',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    borderRadius: 6,
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ConfigProvider locale={viVN} theme={theme} form={{ requiredMark: requiredMarkAfter }}>
        {/* <AntApp> bắt buộc để message/modal nhận được theme + locale (docs/14 mục 3.1.1) */}
        <AntApp>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  </StrictMode>,
);
