import dayjs from 'dayjs';
export const formatCurrency = (value) => (value === null || value === undefined ? '0 đ' : Number(value).toLocaleString('vi-VN') + ' đ');
export const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');
export const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');
export const formatPercent = (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(2).replace('.', ',') + '%');
