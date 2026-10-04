const app = require('./app');
const config = require('./core/config');
const { connectDatabase } = require('./core/config/database');
const logger = require('./core/logger/logger');

async function bootstrap() {
  try {
    await connectDatabase();
    const server = app.listen(config.port, () => {
      logger.info('Aurora Hotel Booking API đang lắng nghe tại cổng ' + config.port);
      logger.info('Health check: http://localhost:' + config.port + '/api/health');
    });
    const shutdown = (signal) => { logger.info('Nhận tín hiệu ' + signal + ', đang đóng server...'); server.close(() => process.exit(0)); };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Không thể khởi động Hotel Booking API:', error);
    process.exit(1);
  }
}
bootstrap();
