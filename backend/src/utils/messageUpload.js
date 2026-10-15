const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const env = require('../config/env');
const { privateUploadRoot, privateUrlPrefix, enforceStorageLimit } = require('./privateAttachments');
const { detectAttachment } = require('./attachmentTypes');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => done(null, privateUploadRoot),
    filename: (_req, _file, done) => done(null, crypto.randomBytes(16).toString('hex'))
  }),
  limits: { fileSize: env.maxAttachmentBytes, files: 1, fields: 5, fieldSize: 4096 }
});

const parseMessageUpload = async (req, res, next) => {
  if (!req.headers['content-type']?.startsWith('multipart/form-data')) {
    req.upload = { fields: req.body || {}, file: null };
    return next();
  }
  try { await fs.mkdir(privateUploadRoot, { recursive: true, mode: 0o700 }); }
  catch (error) { return next(error); }
  upload.single('file')(req, res, async (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        error.statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        error.message = error.code === 'LIMIT_FILE_SIZE' ? 'Allegato troppo grande' : 'Numero o campi di upload non consentiti';
      }
      return next(error);
    }
    const file = req.file;
    if (!file) {
      req.upload = { fields: req.body || {}, file: null };
      return next();
    }
    const discard = () => { if (!req.uploadCommitted) fs.unlink(file.path).catch(() => {}); };
    res.once('finish', discard);
    res.once('close', discard);
    try {
      await fs.chmod(file.path, 0o600);
      if (env.maxAttachmentFilesPerMessage === 0) {
        const denied = new Error('Allegati disabilitati');
        denied.statusCode = 400;
        throw denied;
      }
      if (file.size === 0) {
        const empty = new Error('Allegato vuoto');
        empty.statusCode = 400;
        throw empty;
      }
      const mimeType = await detectAttachment(file.path, file.originalname);
      if (!mimeType) {
        const invalid = new Error('Formato o contenuto dell’allegato non consentito');
        invalid.statusCode = 415;
        throw invalid;
      }
      await enforceStorageLimit();
      req.upload = { fields: req.body || {}, file: {
        url: `${privateUrlPrefix}${file.filename}`,
        originalName: path.basename(file.originalname.replace(/\\/g, '/'))
          .replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '_').slice(0, 180) || 'file',
        mimeType,
        size: file.size
      } };
      return next();
    } catch (failure) {
      await fs.unlink(file.path).catch(() => {});
      return next(failure);
    }
  });
};

module.exports = { parseMessageUpload };
