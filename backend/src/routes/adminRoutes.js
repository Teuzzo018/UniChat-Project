const express = require('express');

const {
  deleteMessage,
  deleteChannel,
  updateChannel,
  deleteServer,
  deleteUser,
  listAudit,
  listOverview,
  updateServer
} = require('../controllers/adminControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { requireSuperadmin } = require('../lib/authorization');
const { changeRole, setServerAdmin, setSuspension } = require('../controllers/roleControllers');
const { requireAdminScope } = require('../lib/adminScope');
const { requireGlobalModerator } = require('../lib/authorization');
const audit = require('../middleware/adminAudit');
const recentSecondFactor = require('../middleware/recentSecondFactor');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/overview', requireAdminScope, asyncHandler(listOverview));
router.get('/audit', requireAdminScope, asyncHandler(listAudit));
router.delete('/messages/:id', audit('MESSAGE_DELETE', 'MESSAGE', 'id'), requireAdminScope, asyncHandler(deleteMessage));
router.patch('/servers/:id', audit('SERVER_UPDATE', 'SERVER', 'id', 'id'), requireAdminScope, asyncHandler(updateServer));
router.patch('/servers/:serverId/channels/:channelId', audit('CHANNEL_UPDATE', 'CHANNEL', 'channelId', 'serverId'), requireAdminScope, asyncHandler(updateChannel));
router.delete('/servers/:serverId/channels/:channelId', audit('CHANNEL_DELETE', 'CHANNEL', 'channelId', 'serverId'), requireAdminScope, asyncHandler(deleteChannel));
router.delete('/servers/:id', audit('SERVER_DELETE', 'SERVER', 'id', 'id'), requireAdminScope, asyncHandler(deleteServer));
router.post('/users/:id/suspension', audit('USER_SUSPEND', 'USER', 'id'), requireAdminScope, requireGlobalModerator, asyncHandler(setSuspension));
router.delete('/users/:id/suspension', audit('USER_REACTIVATE', 'USER', 'id'), requireAdminScope, requireGlobalModerator, asyncHandler(setSuspension));
router.patch('/users/:id/role', audit('USER_ROLE_CHANGE', 'USER', 'id'), requireAdminScope, requireSuperadmin, recentSecondFactor, asyncHandler(changeRole));
router.put('/servers/:serverId/admins/:userId', audit('SERVER_ADMIN_ASSIGN', 'USER', 'userId', 'serverId'), requireAdminScope, requireSuperadmin, recentSecondFactor, asyncHandler(setServerAdmin));
router.delete('/servers/:serverId/admins/:userId', audit('SERVER_ADMIN_REVOKE', 'USER', 'userId', 'serverId'), requireAdminScope, requireSuperadmin, recentSecondFactor, asyncHandler(setServerAdmin));
router.delete('/users/:id', audit('USER_DELETE', 'USER', 'id'), requireAdminScope, requireSuperadmin, recentSecondFactor, asyncHandler(deleteUser));

module.exports = router;
