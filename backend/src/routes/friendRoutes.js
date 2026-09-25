const express = require('express');

const {
  acceptFriendRequest,
  addFriend,
  blockUser,
  declineFriendRequest,
  listBlockedUsers,
  listFriends,
  listFriendRequests,
  removeFriend,
  searchUsers,
  unblockUser
} = require('../controllers/friendControllers');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/', asyncHandler(listFriends));
router.get('/blocked', asyncHandler(listBlockedUsers));
router.get('/requests', asyncHandler(listFriendRequests));
router.get('/search', asyncHandler(searchUsers));
router.post('/', asyncHandler(addFriend));
router.post('/:userId/block', asyncHandler(blockUser));
router.post('/requests/:id/accept', asyncHandler(acceptFriendRequest));
router.delete('/requests/:id', asyncHandler(declineFriendRequest));
router.delete('/blocked/:userId', asyncHandler(unblockUser));
router.delete('/:userId', asyncHandler(removeFriend));

module.exports = router;
