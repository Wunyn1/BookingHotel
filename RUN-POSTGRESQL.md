# Chạy dự án với PostgreSQL trên Windows

## 1. Tạo database

Trong cửa sổ đang hiện `postgres=#`, nhập:

```sql
CREATE DATABASE hotel_booking_db;
\l
\q
```

Nếu PostgreSQL báo database đã tồn tại thì không tạo lại; chỉ cần dùng database hiện có.

## 2. Cấu hình backend

Mở `BE_BookingHotel/.env` và đặt `PGPASSWORD` bằng mật khẩu đã nhập khi chạy `psql -U postgres`. Không gửi mật khẩu này vào chat, không commit file `.env`.

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=hotel_booking_db
PGUSER=postgres
PGPASSWORD=mat_khau_postgres_cua_ban
PGPOOL_MAX=5
ENABLE_CRON=false
```

Tại Command Prompt mới:

```cmd
cd /d D:\SystemResource\ProjectsNodejs\BE_BookingHotel
npm install
npm run db:test
npm run seed
npm run dev
```

Lần đầu chạy `db:test` sẽ tạo bảng trong database. Giữ cửa sổ backend mở. Kiểm tra `http://localhost:5000/api/health`.

## 3. Chạy frontend

`FE_BookingHotel/.env` đã đặt `VITE_USE_MOCK=false` để gọi backend thật.

Trong Command Prompt thứ hai:

```cmd
cd /d D:\SystemResource\ProjectsNodejs\FE_BookingHotel
npm install
npm run dev
```

Mở `http://localhost:5173`. Tài khoản demo được tạo bởi `npm run seed`: `admin@hotel.local` / `Admin@123`. Đổi mật khẩu demo trước khi dùng ngoài máy cá nhân.

## 4. Kiểm tra bảng

```cmd
psql -U postgres -d hotel_booking_db
```

Trong `psql` nhập `\dt`, rồi `\q` để thoát.


