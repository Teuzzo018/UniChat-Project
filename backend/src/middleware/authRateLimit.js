/**
 * ============================================================================
 * MIDDLEWARE RATE LIMITING AUTENTICAZIONE (authRateLimit.js)
 * 1. Tracciamento tentativi: conteggio richieste login/registrazione per indirizzo IP
 * 2. Blocco brute-force: risposta HTTP 429 con Retry-After al superamento del limite
 * ============================================================================
 */
const env = require('../config/env');
const attempts = new Map();
const windowMs = 15 * 60 * 1000;
const maxAttempts = env.authRateLimitMaxAttempts;

module.exports = (req, res, next) => {
  const now = Date.now();
  const key = req.ip;
  const entry = attempts.get(key);
  const current = !entry || entry.expiresAt <= now ? { count: 0, expiresAt: now + windowMs } : entry;
  current.count += 1;
  attempts.set(key, current);
  if (attempts.size > 10000) {
    for (const [ip, value] of attempts) if (value.expiresAt <= now) attempts.delete(ip);
  }
  if (current.count > maxAttempts) {
    res.set('Retry-After', String(Math.ceil((current.expiresAt - now) / 1000)));
    return res.status(429).json({ error: 'Troppe richieste. Riprova più tardi.' });
  }
  return next();
};
