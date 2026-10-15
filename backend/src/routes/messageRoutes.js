const express = require('express');

const { createMessage, deleteChannelMessage, findAccessibleChannel, listMessages } = require('../controllers/messageControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { parseMessageUpload } = require('../utils/messageUpload');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/:channelId/messages', asyncHandler(listMessages));
router.post('/:channelId/messages', asyncHandler(async (req, res, next) => {
  const channel = await findAccessibleChannel(req.params.channelId, req.user.id);
  if (!channel) return res.status(404).json({ error: 'Canale non trovato' });
  if (channel.type !== 'TEXT') return res.status(400).json({ error: 'Canale testuale richiesto' });
  return next();
}), parseMessageUpload, asyncHandler(createMessage));
router.delete('/:channelId/messages/:messageId', asyncHandler(deleteChannelMessage));

module.exports = router;
