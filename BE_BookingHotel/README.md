# Aurora Hotel Booking — Backend

REST API Node.js/Express và PostgreSQL cho hệ thống booking hotel.

## Chạy dự án

    npm install
    npm run dev

Backend đọc cấu hình PostgreSQL từ .env: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD và PORT. Khi khởi động, schema hotel được tạo tự động và có dữ liệu demo.

## API chính

- GET /api/health
- POST /api/auth/register
- POST /api/auth/login
- GET /api/hotel/room-types?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=2&children=0
- GET /api/hotel/room-types/:id
- POST /api/hotel/bookings
- GET /api/hotel/bookings
- PATCH /api/hotel/bookings/:id/cancel
- PATCH /api/hotel/bookings/:id/status
- GET /api/hotel/dashboard
- GET /api/hotel/rooms
- PATCH /api/hotel/rooms/:id/status
- GET /api/hotel/reviews
- POST /api/hotel/reviews

## Tài khoản seed

admin@hotel.local / Admin@123

reception@hotel.local / Staff@123

customer@hotel.local / Customer@123

## Chống overbooking

Khi tạo booking, backend mở transaction PostgreSQL, khóa các phòng phù hợp bằng FOR UPDATE, kiểm tra giao nhau của khoảng [check_in, check_out), rồi mới ghi đơn. Hai request đồng thời không thể giữ cùng một phòng trong cùng khoảng thời gian.
