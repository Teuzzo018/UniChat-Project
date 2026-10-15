const express = require('express');
const router = express.Router();

const {
  getAuthenticatedUser,
  login,
  logout,
  register,
  updateAuthenticatedUser,
  bootstrapSuperadmin
} = require('../controllers/authControllers');
const authMiddleware = require('../middleware/authMiddleware');
const { parseMultipartUpload } = require('../utils/uploadParser');
const authRateLimit = require('../middleware/authRateLimit');
const audit = require('../middleware/adminAudit');
const recentSecondFactor = require('../middleware/recentSecondFactor');
const twoFactor = require('../controllers/twoFactorControllers');
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post('/register', authRateLimit, parseMultipartUpload, register);
router.post('/login', authRateLimit, login);
router.post('/bootstrap-superadmin', authRateLimit, authMiddleware, audit('SUPERADMIN_BOOTSTRAP', 'USER', 'self'), recentSecondFactor, asyncHandler(bootstrapSuperadmin));
router.post('/logout', logout);

router.get('/2fa/status', authMiddleware, asyncHandler(twoFactor.status));
router.post('/2fa/setup', authRateLimit, authMiddleware, audit('MFA_SETUP', 'USER', 'self'), asyncHandler(twoFactor.setup));
router.post('/2fa/enable', authRateLimit, authMiddleware, audit('MFA_ENABLE', 'USER', 'self'), asyncHandler(twoFactor.enable));
router.post('/2fa/verify', authRateLimit, authMiddleware.allowPending, audit('MFA_VERIFY', 'USER', 'self'), asyncHandler(twoFactor.verifyLogin));
router.post('/2fa/step-up', authRateLimit, authMiddleware, audit('MFA_STEP_UP', 'USER', 'self'), asyncHandler(twoFactor.stepUp));
router.post('/2fa/disable', authRateLimit, authMiddleware, audit('MFA_DISABLE', 'USER', 'self'), asyncHandler(twoFactor.disable));
router.post('/2fa/recovery-codes', authRateLimit, authMiddleware, audit('MFA_RECOVERY_REGENERATE', 'USER', 'self'), asyncHandler(twoFactor.regenerate));

router.get('/me', authMiddleware, getAuthenticatedUser);
router.patch('/me', authMiddleware, parseMultipartUpload, updateAuthenticatedUser);
router.get('/authentication', authMiddleware, getAuthenticatedUser);

module.exports = router;
