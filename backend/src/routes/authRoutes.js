const express = require('express');
const router = express.Router();

const {
  getAuthenticatedUser,
  login,
  logout,
  register,
  updateAuthenticatedUser
} = require('../controllers/authControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { parseMultipartUpload } = require('../utils/uploadParser');

router.post('/register', parseMultipartUpload, register);
router.post('/login', login);
router.post('/logout', logout);

router.get('/me', authMiddleware, getAuthenticatedUser);
router.patch('/me', authMiddleware, parseMultipartUpload, updateAuthenticatedUser);
router.get('/authentication', authMiddleware, getAuthenticatedUser);

module.exports = router;
