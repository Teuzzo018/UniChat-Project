/**
 * ============================================================================
 * ROTTE SERVER UNIVERSITARI (/api/servers)
 * 1. CRUD server, inviti, canali, richieste d'accesso e appartenenze
 * ============================================================================
 */
const express = require('express');

const {
  acceptServerJoinRequest,
  createChannel,
  createServer,
  declineServerJoinRequest,
  deleteOrLeaveServer,
  getServer,
  getServerInvite,
  joinServer,
  joinServerByInvite,
  listAvailableServers,
  listServerJoinRequests,
  listServers,
  revokeServerInvite,
  rotateServerInvite,
  setDiscoverability
} = require('../controllers/serverControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { deleteServerMessage } = require('../controllers/messageControllers');
const audit = require('../middleware/adminAudit');

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
router.get('/:id/invite', asyncHandler(getServerInvite));
router.post('/:id/invite', asyncHandler(rotateServerInvite));
router.delete('/:id/invite', asyncHandler(revokeServerInvite));
router.patch('/:id/discoverability', asyncHandler(setDiscoverability));
router.post('/:id/join', asyncHandler(joinServer));
router.delete('/:id', audit('SERVER_DELETE_OR_LEAVE', 'SERVER', 'id', 'id'), asyncHandler(deleteOrLeaveServer));
router.post('/:id/channels', audit('CHANNEL_CREATE', 'SERVER', 'id', 'id'), asyncHandler(createChannel));
router.delete('/:id/messages/:messageId', audit('MESSAGE_DELETE', 'MESSAGE', 'messageId', 'id'), asyncHandler(deleteServerMessage));

module.exports = router;
