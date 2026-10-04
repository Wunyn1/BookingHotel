const { connectDatabase, closeDatabase } = require('./core/config/database');
connectDatabase().then(closeDatabase).catch((error) => { console.error(error); process.exitCode = 1; });
