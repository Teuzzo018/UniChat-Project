/**
 * ============================================================================
 * GESTIONE TOKEN DI SESSIONE (sessionTokens.js)
 * 1. Generazione token: creazione token casuale crittografico a 32 byte esadecimali
 * 2. Hashing token: calcolo hash HMAC-SHA256 con pepper del server per il database
 * ============================================================================
 */
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
