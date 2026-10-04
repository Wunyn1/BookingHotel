/**
 * Utility sinh mã tự động cho các thực thể theo chuẩn tài liệu DATA-SCHEMA.md và API.md.
 * Đảm bảo tính duy nhất, format chuẩn và dễ đọc.
 */

const crypto = require('crypto');

/**
 * Sinh số ngẫu nhiên 5 chữ số có đệm 0
 */
const getRandom5Digits = () => {
  return String(crypto.randomInt(1, 100000)).padStart(5, '0');
};

/**
 * Mã đơn đăng ký: DK-YYYY-XXXXX (e.g. DK-2026-00043)
 */
const generateApplicationCode = () => {
  const year = new Date().getFullYear();
  return `DK-${year}-${getRandom5Digits()}`;
};

/**
 * Mã hợp đồng: HD-YYYY-XXXXX (e.g. HD-2026-00087)
 */
const generateContractCode = () => {
  const year = new Date().getFullYear();
  return `HD-${year}-${getRandom5Digits()}`;
};

/**
 * Mã hóa đơn: INV-YYYYMM-XXXXX (e.g. INV-202609-00101)
 */
const generateInvoiceCode = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${getRandom5Digits()}`;
};

/**
 * Mã yêu cầu tự phục vụ: YC-YYYY-XXXXX (e.g. YC-2026-00005)
 */
const generateRequestCode = () => {
  const year = new Date().getFullYear();
  return `YC-${year}-${getRandom5Digits()}`;
};

/**
 * Mã đơn hàng nhu yếu phẩm: DH-YYYY-XXXXX (e.g. DH-2026-00012)
 */
const generateOrderCode = () => {
  const year = new Date().getFullYear();
  return `DH-${year}-${getRandom5Digits()}`;
};

/**
 * Mã tham chiếu thanh toán: PAYYYYYMMDDXXXXXX (e.g. PAY20261108DEF456)
 */
const generateTransactionRef = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PAY${dateStr}${randomHex}`;
};

module.exports = {
  generateApplicationCode,
  generateContractCode,
  generateInvoiceCode,
  generateRequestCode,
  generateOrderCode,
  generateTransactionRef,
};
