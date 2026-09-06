const express = require('express');

const adminRoutes = require('./adminRoutes');
const authRoutes = require('./authRoutes');
const messageRoutes = require('./messageRoutes');
const serverRoutes = require('./serverRoutes');
const universityRoutes = require('./universityRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/servers', serverRoutes);
router.use('/channels', messageRoutes);
router.use('/universities', universityRoutes);
router.use('/university', universityRoutes);

module.exports = router;
