import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pre-bundle các dependency lớn để trình duyệt chỉ tải một vài module đã gộp,
  // thay vì phải mở hàng nghìn request đến từng icon con của Ant Design.
  optimizeDeps: {
    include: ['antd', '@ant-design/icons'],
  },
})
