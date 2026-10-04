const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const { pool } = require('../../core/config/database');
const config = require('../../core/config');
const logger = require('../../core/logger/logger');

let transporter;
const money = (value) => Number(value || 0).toLocaleString('vi-VN') + ' đ';
const dateText = (value) => new Date(`${value}T00:00:00Z`).toLocaleDateString('vi-VN');

function isConfigured() {
  if (config.env === 'test') return false;
  const password = String(config.mail.password || '');
  const isPlaceholder = /^(your_|mat_khau|your-password|change_me|password)/i.test(password);
  return Boolean(config.mail.host && config.mail.user && password && !isPlaceholder);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: { user: config.mail.user, pass: config.mail.password },
    });
  }
  return transporter;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

async function getBookingMailData(bookingId) {
  const result = await pool.query(`
    SELECT b.*, t.name AS room_type_name,
      COALESCE((SELECT ARRAY_AGG(r2.room_number ORDER BY r2.room_number)
        FROM hotel_booking_rooms br2 JOIN hotel_rooms r2 ON r2.id=br2.room_id
        WHERE br2.booking_id=b.id), ARRAY[r.room_number]) AS room_numbers,
      COALESCE((SELECT SUM(p.amount) FROM hotel_payments p
        WHERE p.booking_id=b.id AND p.status='success'), 0) AS paid_amount
    FROM hotel_bookings b
    JOIN hotel_rooms r ON r.id=b.room_id
    JOIN hotel_room_types t ON t.id=r.room_type_id
    WHERE b.id=$1`, [bookingId]);
  return result.rows[0];
}

function confirmationHtml(booking) {
  const rooms = booking.room_numbers?.join(', ') || 'Đang cập nhật';
  const paid = Number(booking.paid_amount || 0);
  const remaining = Math.max(0, Number(booking.total_amount) - paid);
  return `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#203d34">
      <div style="background:#21483d;padding:24px;color:#fff">
        <h1 style="margin:0">AURORA HOTEL</h1>
        <p style="margin:8px 0 0">Xác nhận đặt phòng thành công</p>
      </div>
      <div style="padding:24px;border:1px solid #dfe8e2">
        <p>Xin chào <b>${escapeHtml(booking.guest_name)}</b>,</p>
        <p>Khách sạn đã ghi nhận đơn đặt phòng của bạn.</p>
        <table style="width:100%;border-collapse:collapse;line-height:2">
          <tr><td><b>Mã đặt phòng</b></td><td>${escapeHtml(booking.booking_code)}</td></tr>
          <tr><td><b>Loại phòng</b></td><td>${escapeHtml(booking.room_type_name)}</td></tr>
          <tr><td><b>Phòng</b></td><td>${escapeHtml(rooms)}</td></tr>
          <tr><td><b>Nhận phòng</b></td><td>${dateText(booking.check_in)}</td></tr>
          <tr><td><b>Trả phòng</b></td><td>${dateText(booking.check_out)}</td></tr>
          <tr><td><b>Tổng tiền</b></td><td>${money(booking.total_amount)}</td></tr>
          <tr><td><b>Đã thanh toán</b></td><td>${money(paid)}</td></tr>
          <tr><td><b>Còn lại</b></td><td>${money(remaining)}</td></tr>
        </table>
        <div style="text-align:center;margin:28px 0 12px">
          <p style="font-weight:bold;margin-bottom:12px">Mã QR check-in</p>
          <img src="cid:booking-qr@aurora" alt="QR check-in" width="260" height="260" />
          <p style="font-size:12px;color:#667">Nếu không quét được QR, cung cấp mã: <b>${escapeHtml(booking.booking_code)}</b></p>
        </div>
        <p style="background:#f2f7f3;padding:14px">Khi đến khách sạn, vui lòng mở email này để lễ tân quét mã QR hoặc cung cấp mã đặt phòng.</p>
        <p style="font-size:12px;color:#667">QR chỉ chứa mã tra cứu booking, không chứa thông tin nhạy cảm của khách hàng.</p>
      </div>
    </div>`;
}

async function sendBookingConfirmationEmail(bookingId, { force = false } = {}) {
  const booking = await getBookingMailData(bookingId);
  if (!booking) return { sent: false, reason: 'BOOKING_NOT_FOUND' };
  if (!['confirmed', 'checked_in', 'checked_out', 'completed'].includes(booking.status)) {
    return { sent: false, reason: 'BOOKING_NOT_CONFIRMED' };
  }
  if (booking.confirmation_email_sent_at && !force) {
    return { sent: true, alreadySent: true, sentAt: booking.confirmation_email_sent_at };
  }
  if (!isConfigured()) {
    logger.warn('Chưa cấu hình SMTP nên chưa thể gửi email xác nhận booking', { bookingId });
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    const qr = await QRCode.toBuffer(booking.qr_token, {
      type: 'png', width: 320, margin: 2,
      color: { dark: '#203d34', light: '#ffffff' },
    });
    const info = await getTransporter().sendMail({
      from: config.mail.from,
      to: booking.guest_email,
      subject: `Aurora Hotel - Xác nhận đặt phòng ${booking.booking_code}`,
      html: confirmationHtml(booking),
      attachments: [{ filename: `${booking.booking_code}-checkin.png`, content: qr, cid: 'booking-qr@aurora' }],
    });
    await pool.query('UPDATE hotel_bookings SET confirmation_email_sent_at=NOW(), confirmation_email_error=NULL, updated_at=NOW() WHERE id=$1', [bookingId]);
    logger.info('Đã gửi email xác nhận booking', { bookingId, messageId: info.messageId });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    await pool.query('UPDATE hotel_bookings SET confirmation_email_error=$1, updated_at=NOW() WHERE id=$2', [error.message, bookingId]);
    logger.error('Gửi email xác nhận booking thất bại', error);
    return { sent: false, reason: 'EMAIL_SEND_FAILED', error: error.message };
  }
}

module.exports = { sendBookingConfirmationEmail };
