/**
 * ============================================================================
 * ROTTE AUTENTICAZIONE (/api/auth)
 * 1. Registrazione, login, logout e gestione profilo utente autenticato
 * ============================================================================
 */
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
const authRateLimit = require('../middleware/authRateLimit');
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post('/register', authRateLimit, parseMultipartUpload, register);
router.post('/login', authRateLimit, login);
router.post('/logout', logout);

router.get('/me', authMiddleware, getAuthenticatedUser);
router.patch('/me', authMiddleware, parseMultipartUpload, updateAuthenticatedUser);
router.get('/authentication', authMiddleware, getAuthenticatedUser);

module.exports = router;
