const crypto = require('node:crypto');
const env = require('../config/env');

let otplibPromise;
const otplib = () => {
  otplibPromise ||= import('otplib');
  return otplibPromise;
};

const encryptionKey = () => {
  if (!env.totpEncryptionKey) {
    const error = new Error('Chiave TOTP non configurata');
    error.statusCode = 503;
    throw error;
  }
  return Buffer.from(env.totpEncryptionKey, 'hex');
};

const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
};

const decryptSecret = (value) => {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) throw new Error('Segreto TOTP non valido');
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

const generateEnrollment = async (email) => {
  const { generateSecret, generateURI } = await otplib();
  const secret = generateSecret();
  return { secret, uri: generateURI({ issuer: 'UniChat', label: email, secret }) };
};

const verifyTotp = async (encrypted, token, afterTimeStep) => {
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) return { valid: false };
  const secret = decryptSecret(encrypted);
  const { verify } = await otplib();
  try {
    return await verify({
      secret,
      token,
      ...(afterTimeStep == null ? {} : { afterTimeStep }),
      epochTolerance: 0
    });
  } catch {
    return { valid: false };
  }
};

const normalizeRecoveryCode = (value) => typeof value === 'string'
  ? value.replace(/[\s-]/g, '').toUpperCase() : '';
const hashRecoveryCode = (value) => crypto.createHash('sha256')
  .update(normalizeRecoveryCode(value)).digest('hex');
const generateRecoveryCodes = (count = 10) => Array.from({ length: count }, () => {
  const raw = crypto.randomBytes(16).toString('hex').toUpperCase();
  return raw.match(/.{1,8}/g).join('-');
});

module.exports = {
  decryptSecret,
  encryptSecret,
  generateEnrollment,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotp
};
