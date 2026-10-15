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
  adminSetupCode: process.env.ADMIN_SETUP_CODE || '',
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY || ''
};

const positiveInteger = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} deve essere un intero non negativo`);
  return value;
};

env.maxAttachmentBytes = positiveInteger('MAX_ATTACHMENT_BYTES', 25 * 1024 * 1024);
env.maxAttachmentFilesPerMessage = positiveInteger('MAX_ATTACHMENT_FILES_PER_MESSAGE', 1);
env.maxAttachmentStorageBytes = positiveInteger('MAX_ATTACHMENT_STORAGE_BYTES', 1024 * 1024 * 1024);
env.callRingTimeoutMs = positiveInteger('CALL_RING_TIMEOUT_MS', 30000);
if (env.callRingTimeoutMs < 10000 || env.callRingTimeoutMs > 120000) throw new Error('CALL_RING_TIMEOUT_MS deve essere tra 10000 e 120000');
env.callMaxDurationMs = positiveInteger('CALL_MAX_DURATION_MS', 45 * 60 * 1000);
if (env.callMaxDurationMs < 60000 || env.callMaxDurationMs > 55 * 60 * 1000) throw new Error('CALL_MAX_DURATION_MS deve essere tra 60000 e 3300000');
const rtcUrls = (name, pattern, fallback = '') => {
  const urls = (process.env[name] ?? fallback).split(',').map((url) => url.trim()).filter(Boolean);
  if (urls.length > 8 || urls.some((url) => url.length > 512 || !pattern.test(url) || /[\s@]/.test(url))) throw new Error(`${name} contiene URL non validi`);
  return urls;
};
env.webRtcStunUrls = rtcUrls('WEBRTC_STUN_URLS', /^stuns?:[^\s@]+$/i, 'stun:stun.l.google.com:19302');
env.webRtcTurnUrls = rtcUrls('WEBRTC_TURN_URLS', /^turns?:[^\s@]+$/i);
env.webRtcTurnSharedSecret = process.env.WEBRTC_TURN_SHARED_SECRET || '';
if (env.webRtcTurnUrls.length && env.webRtcTurnSharedSecret.length < 32) throw new Error('WEBRTC_TURN_SHARED_SECRET richiede almeno 32 caratteri quando TURN è configurato');
if (env.maxAttachmentFilesPerMessage > 1) throw new Error('Il modello attuale supporta al massimo un allegato per messaggio');
if (env.maxAttachmentBytes === 0) throw new Error('MAX_ATTACHMENT_BYTES deve essere maggiore di zero');

if (env.totpEncryptionKey && !/^[a-fA-F0-9]{64}$/.test(env.totpEncryptionKey)) {
  throw new Error('TOTP_ENCRYPTION_KEY deve essere una chiave esadecimale di 32 byte');
}

if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_TOKEN_PEPPER || process.env.SESSION_TOKEN_PEPPER.length < 32 || /^(replace-with|unichat-dev)/.test(process.env.SESSION_TOKEN_PEPPER))) {
  throw new Error('SESSION_TOKEN_PEPPER deve contenere almeno 32 caratteri in produzione');
}
if (process.env.NODE_ENV === 'production' && /^replace-with/.test(env.adminSetupCode)) {
  throw new Error('ADMIN_SETUP_CODE di esempio non consentito in produzione');
}

module.exports = env;
