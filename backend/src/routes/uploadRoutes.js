const express = require('express');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadRoot } = require('../utils/uploadParser');
const { privateUploadRoot, internalName } = require('../utils/privateAttachments');
const findAuthorizedAttachment = require('../utils/attachmentAccess');
const env = require('../config/env');

const router = express.Router();
const validName = (name) => typeof name === 'string' && /^[a-zA-Z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
const fileUrl = (name) => `/uploads/${name}`;

const serveAttachment = async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!validName(filename)) return res.status(404).json({ error: 'File non trovato' });
    const isPrivate = req.path.startsWith('/private-uploads/');
    if (isPrivate && !internalName(filename)) return res.status(404).json({ error: 'File non trovato' });
    const url = isPrivate ? `/private-uploads/${filename}` : fileUrl(filename);
    const attachment = await findAuthorizedAttachment(url, req.user.id);
    if (!attachment) return res.status(404).json({ error: 'File non trovato' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, no-store');
    res.set('Content-Security-Policy', 'sandbox');
    const displayName = String(attachment.attachmentName || 'file')
      .replace(/[\x00-\x1f\x7f"\\/\u202a-\u202e\u2066-\u2069]/g, '_').slice(0, 180);
    res.set('Content-Disposition', `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(displayName)}`);
    res.type('application/octet-stream');
    return res.sendFile(path.join(isPrivate ? privateUploadRoot : uploadRoot, filename), (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) { return next(error); }
};

router.get('/config', authMiddleware, (_req, res) => res.json({
  maxBytes: env.maxAttachmentBytes,
  maxFilesPerMessage: env.maxAttachmentFilesPerMessage,
  maxStorageBytes: env.maxAttachmentStorageBytes,
  allowedExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'zip', 'txt', 'wav', 'ogg', 'mp3', 'mp4', 'webm']
}));
router.get('/:filename', authMiddleware, serveAttachment);
router.get('/private-uploads/:filename', authMiddleware, serveAttachment);

module.exports = router;
