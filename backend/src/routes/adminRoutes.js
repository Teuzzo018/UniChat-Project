const express = require('express');

const {
  deleteMessage,
  deleteServer,
  deleteUser,
  listOverview
} = require('../controllers/adminControllers');
const adminMiddleware = require('../middleware/adminMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/overview', asyncHandler(listOverview));
router.delete('/messages/:id', asyncHandler(deleteMessage));
router.delete('/servers/:id', asyncHandler(deleteServer));
router.delete('/users/:id', asyncHandler(deleteUser));

module.exports = router;
