const express = require('express');
const crypto = require('node:crypto');
const authMiddleware = require('../middleware/authMiddleware');
const env = require('../config/env');

const router = express.Router();
router.use(authMiddleware);

router.post('/voice-token', async (req, res, next) => {
  try {
    const { AccessToken } = require('livekit-server-sdk');
    const { findAccessibleChannel } = require('../controllers/messageControllers');
    const channelId = req.body?.channelId;
    if (typeof channelId !== 'string' || !channelId || channelId.length > 100) {
      return res.status(400).json({ error: 'Chat vocale non valida' });
    }
    const channel = await findAccessibleChannel(channelId, req.user.id);
    if (!channel || channel.type !== 'VOICE') {
      return res.status(403).json({ error: 'Chat vocale non disponibile' });
    }
    if (!env.livekitUrl || !env.livekitApiKey || !env.livekitApiSecret) {
      return res.status(503).json({ error: 'LiveKit non configurato' });
    }
    const roomName = `unichat-voice-${channel.id}`;
    const token = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
      identity: `${req.user.id}:${crypto.randomUUID()}`,
      name: req.user.fullName,
      ttl: '15m'
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ url: env.livekitUrl, token: await token.toJwt() });
  } catch (error) { return next(error); }
});

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
