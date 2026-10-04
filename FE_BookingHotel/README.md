# Aurora Hotel Booking — Frontend

Frontend React/Vite cho hệ thống đặt phòng khách sạn.

## Chạy dự án

    npm install
    npm run dev

Mặc định frontend dùng dữ liệu demo để có thể chạy ngay. Muốn gọi backend thật, tạo file .env với:

    VITE_USE_MOCK=false
    VITE_API_BASE_URL=http://localhost:5000/api

## Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | admin@hotel.local | Admin@123 |
| Lễ tân | reception@hotel.local | Staff@123 |
| Khách hàng | customer@hotel.local | Customer@123 |

## Chức năng chính

- Tìm phòng theo ngày nhận/trả phòng và số lượng khách.
- Xem loại phòng, tiện nghi, giá và số phòng còn trống.
- Đặt phòng, chọn đặt cọc hoặc thanh toán tại khách sạn.
- Khách hàng xem và hủy đơn đặt phòng.
- Dashboard doanh thu/công suất cho quản trị và lễ tân.
- Sơ đồ phòng cho lễ tân và housekeeping.
