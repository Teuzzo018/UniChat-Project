const express = require('express');
const router = express.Router();

const { createUniversity, deleteUniversity, listUniversities } = require('../controllers/universityControllers');
const { requireSuperadmin } = require('../lib/authorization');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncHandler(listUniversities));
router.post('/', authMiddleware, requireSuperadmin, asyncHandler(createUniversity));
router.delete('/:id', authMiddleware, requireSuperadmin, asyncHandler(deleteUniversity));

module.exports = router;
