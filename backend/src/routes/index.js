const express = require('express');

const adminRoutes = require('./adminRoutes');
const authRoutes = require('./authRoutes');
const friendRoutes = require('./friendRoutes');
const messageRoutes = require('./messageRoutes');
const privateRoutes = require('./privateRoutes');
const serverRoutes = require('./serverRoutes');
const universityRoutes = require('./universityRoutes');

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

module.exports = router;
