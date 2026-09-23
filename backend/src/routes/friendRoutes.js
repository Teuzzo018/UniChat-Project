const express = require('express');

const {
  addFriend,
  listFriends,
  removeFriend,
  searchUsers
} = require('../controllers/friendControllers');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/', asyncHandler(listFriends));
router.get('/search', asyncHandler(searchUsers));
router.post('/', asyncHandler(addFriend));
router.delete('/:userId', asyncHandler(removeFriend));

module.exports = router;
