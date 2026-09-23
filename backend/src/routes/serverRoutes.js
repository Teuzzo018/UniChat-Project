const express = require('express');

const {
  acceptServerJoinRequest,
  createChannel,
  createServer,
  declineServerJoinRequest,
  deleteOrLeaveServer,
  getServer,
  joinServer,
  joinServerByInvite,
  listAvailableServers,
  listServerJoinRequests,
  listServers
} = require('../controllers/serverControllers');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/', asyncHandler(listServers));
router.post('/', asyncHandler(createServer));
router.get('/available', asyncHandler(listAvailableServers));
router.get('/join-requests', asyncHandler(listServerJoinRequests));
router.post('/join-by-invite', asyncHandler(joinServerByInvite));
router.post('/join-requests/:requestId/accept', asyncHandler(acceptServerJoinRequest));
router.delete('/join-requests/:requestId', asyncHandler(declineServerJoinRequest));
router.get('/:id', asyncHandler(getServer));
router.post('/:id/join', asyncHandler(joinServer));
router.delete('/:id', asyncHandler(deleteOrLeaveServer));
router.post('/:id/channels', asyncHandler(createChannel));

module.exports = router;
