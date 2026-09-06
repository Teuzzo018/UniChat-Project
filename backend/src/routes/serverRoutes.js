const express = require('express');

const {
  createChannel,
  createServer,
  deleteOrLeaveServer,
  getServer,
  joinServer,
  joinServerByInvite,
  listAvailableServers,
  listServers
} = require('../controllers/serverControllers');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/', asyncHandler(listServers));
router.post('/', asyncHandler(createServer));
router.get('/available', asyncHandler(listAvailableServers));
router.post('/join-by-invite', asyncHandler(joinServerByInvite));
router.get('/:id', asyncHandler(getServer));
router.post('/:id/join', asyncHandler(joinServer));
router.delete('/:id', asyncHandler(deleteOrLeaveServer));
router.post('/:id/channels', asyncHandler(createChannel));

module.exports = router;
