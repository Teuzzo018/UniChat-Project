const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../../.env')
});

const env = {
  port: Number(process.env.PORT) || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  sessionDurationDays: Number(process.env.SESSION_DURATION_DAYS) || 7,
  saltRounds: Number(process.env.SALT_ROUNDS) || 12,
  sessionTokenPepper: process.env.SESSION_TOKEN_PEPPER || 'unichat-dev-session-pepper',
  adminSetupCode: process.env.ADMIN_SETUP_CODE || ''
};

module.exports = env;
