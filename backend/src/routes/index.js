/**
 * ============================================================================
 * ROUTER PRINCIPALE DELLE API (routes/index.js)
 * 1. Aggregatore di tutti i sotto-router (/auth, /servers, /channels, /friends, ecc.)
 * ============================================================================
 */
const express = require('express');

const adminRoutes = require('./adminRoutes');
const authRoutes = require('./authRoutes');
const friendRoutes = require('./friendRoutes');
const messageRoutes = require('./messageRoutes');
const privateRoutes = require('./privateRoutes');
const serverRoutes = require('./serverRoutes');
const universityRoutes = require('./universityRoutes');
const uploadRoutes = require('./uploadRoutes');
const searchRoutes = require('./searchRoutes');
const rtcRoutes = require('./rtcRoutes');
const favoriteRoutes = require('./favoriteRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/friends', friendRoutes);
router.use('/private', privateRoutes);
router.use('/servers', serverRoutes);
router.use('/channels', messageRoutes);
router.use('/universities', universityRoutes);
router.use('/university', universityRoutes);
router.use('/uploads', uploadRoutes);
router.use('/search', searchRoutes);
router.use('/rtc', rtcRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
