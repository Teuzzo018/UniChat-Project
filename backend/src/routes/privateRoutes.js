const express = require('express');

const {
  createPrivateMessage,
  canContact,
  deletePrivateMessage,
  listPrivateCalls,
  listPrivateConversations,
  listPrivateMessages
} = require('../controllers/messageControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { parseMessageUpload } = require('../utils/messageUpload');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/conversations', asyncHandler(listPrivateConversations));
router.get('/:userId/messages', asyncHandler(listPrivateMessages));
router.get('/:userId/calls', asyncHandler(listPrivateCalls));
router.post('/:userId/messages', asyncHandler(async (req, res, next) => {
  if (!req.params.userId || req.params.userId === req.user.id || !await canContact(req.user.id, req.params.userId)) {
    return res.status(403).json({ error: 'Conversazione non disponibile' });
  }
  return next();
}), parseMessageUpload, asyncHandler(createPrivateMessage));
router.delete('/:userId/messages/:messageId', asyncHandler(deletePrivateMessage));

module.exports = router;
