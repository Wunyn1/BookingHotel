const express = require('express');
const cors = require('cors');
const config = require('./core/config');
const requestLogger = require('./core/middlewares/request-logger');
const errorHandler = require('./core/middlewares/error-handler');
const ApiError = require('./core/errors/api-error');
const ApiResponse = require('./core/utils/response');

const app = express();
app.use(cors({ origin: config.cors.origin.includes('*') ? true : config.cors.origin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestLogger);
app.get('/api/health', (req, res) => ApiResponse.success(res, { status: 'healthy', service: 'Hotel Booking API', timestamp: new Date().toISOString() }, 'Hotel Booking đang hoạt động'));
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/hotel', require('./modules/hotel/hotel.routes'));
app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);
module.exports = app;
