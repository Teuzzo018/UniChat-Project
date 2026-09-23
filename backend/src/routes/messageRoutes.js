const express = require('express');

const { createMessage, listMessages } = require('../controllers/messageControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { parseMultipartUpload } = require('../utils/uploadParser');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/:channelId/messages', asyncHandler(listMessages));
router.post('/:channelId/messages', parseMultipartUpload, asyncHandler(createMessage));

module.exports = router;
