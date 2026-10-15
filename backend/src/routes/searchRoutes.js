const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { searchGlobal } = require('../controllers/searchControllers');

const router = express.Router();
router.get('/', authMiddleware, (req, res, next) => Promise.resolve(searchGlobal(req, res)).catch(next));
module.exports = router;
