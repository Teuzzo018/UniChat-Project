const crypto = require('crypto');

const env = require('../config/env');

const createSessionToken = () => crypto.randomBytes(32).toString('hex');

const hashSessionToken = (token) => (
  crypto
    .createHmac('sha256', env.sessionTokenPepper)
    .update(token)
    .digest('hex')
);

module.exports = {
  createSessionToken,
  hashSessionToken
};
