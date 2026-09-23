const express = require('express');

const {
  acceptFriendRequest,
  addFriend,
  declineFriendRequest,
  listFriends,
  listFriendRequests,
  removeFriend,
  searchUsers
} = require('../controllers/friendControllers');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/', asyncHandler(listFriends));
router.get('/requests', asyncHandler(listFriendRequests));
router.get('/search', asyncHandler(searchUsers));
router.post('/', asyncHandler(addFriend));
router.post('/requests/:id/accept', asyncHandler(acceptFriendRequest));
router.delete('/requests/:id', asyncHandler(declineFriendRequest));
router.delete('/:userId', asyncHandler(removeFriend));

module.exports = router;
