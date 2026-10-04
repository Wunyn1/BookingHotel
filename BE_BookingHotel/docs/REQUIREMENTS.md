# Yêu cầu hệ thống Aurora Hotel Booking

## Khách hàng

- Tìm phòng theo check-in, check-out, người lớn, trẻ em và số phòng.
- Xem loại phòng, diện tích, giường, tiện nghi, giá và đánh giá.
- Nhập thông tin người đặt, yêu cầu đặc biệt và phương thức thanh toán.
- Nhận mã booking và QR token; xem hoặc hủy đơn theo chính sách.

## Lễ tân và buồng phòng

- Xem danh sách booking theo trạng thái.
- Check-in, check-out, hủy booking tại quầy.
- Theo dõi sơ đồ phòng: trống, đã đặt, đang ở, đang dọn, bảo trì.
- Cập nhật trạng thái phòng sau khi dọn hoặc bảo trì.

## Quản trị

- Dashboard doanh thu, số booking, công suất phòng và loại phòng phổ biến.
- Quản lý loại phòng, phòng cụ thể, giá ngày thường/cuối tuần.
- Phân quyền RBAC: customer, receptionist, housekeeping, manager, admin.

## Toàn vẹn dữ liệu

Booking phải được ghi trong transaction PostgreSQL. Backend khóa các phòng ứng viên bằng FOR UPDATE và kiểm tra điều kiện giao nhau:

    existing.check_in < requested.check_out
    existing.check_out > requested.check_in

Vì vậy hai khách không thể đặt trùng cùng một phòng trong cùng khoảng thời gian.
