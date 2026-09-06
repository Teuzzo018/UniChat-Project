const express = require('express');
const router = express.Router();

const { createUniversity, deleteUniversity, listUniversities } = require('../controllers/universityControllers');
const adminMiddleware = require('../middleware/adminMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncHandler(listUniversities));
router.post('/', asyncHandler(createUniversity));
router.delete('/:id', authMiddleware, adminMiddleware, asyncHandler(deleteUniversity));

module.exports = router;
