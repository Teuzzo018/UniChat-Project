const express = require('express');
const crypto = require('node:crypto');
const authMiddleware = require('../middleware/authMiddleware');
const env = require('../config/env');

const router = express.Router();
router.use(authMiddleware);

router.get('/config', (req, res) => {
  const iceServers = [];
  if (env.webRtcStunUrls.length) iceServers.push({ urls: env.webRtcStunUrls });
  if (env.webRtcTurnUrls.length) {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const username = `${expires}:${req.user.id}`;
    const credential = crypto.createHmac('sha1', env.webRtcTurnSharedSecret).update(username).digest('base64');
    iceServers.push({ urls: env.webRtcTurnUrls, username, credential });
  }
  res.set('Cache-Control', 'private, no-store');
  return res.json({ iceServers, turnExpiresInSeconds: env.webRtcTurnUrls.length ? 3600 : null });
});

module.exports = router;
