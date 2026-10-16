const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { listFavorites, changeFavorite } = require('../controllers/favoriteControllers');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(authMiddleware);
router.get('/', asyncHandler(listFavorites));
router.put('/:kind/:messageId', asyncHandler(changeFavorite));
router.delete('/:kind/:messageId', asyncHandler(changeFavorite));

module.exports = router;
