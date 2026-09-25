const express = require('express');

const {
  createPrivateMessage,
  listPrivateCalls,
  listPrivateMessages
} = require('../controllers/messageControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { parseMultipartUpload } = require('../utils/uploadParser');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/:userId/messages', asyncHandler(listPrivateMessages));
router.get('/:userId/calls', asyncHandler(listPrivateCalls));
router.post('/:userId/messages', parseMultipartUpload, asyncHandler(createPrivateMessage));

module.exports = router;
