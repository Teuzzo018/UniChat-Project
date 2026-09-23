const express = require('express');
const router = express.Router();

const {
  getAuthenticatedUser,
  login,
  logout,
  register
} = require('../controllers/authControllers');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

router.get('/me', authMiddleware, getAuthenticatedUser);
router.get('/authentication', authMiddleware, getAuthenticatedUser);

module.exports = router;
