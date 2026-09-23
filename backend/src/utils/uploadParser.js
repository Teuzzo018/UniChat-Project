const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const multer = require('multer');

const uploadRoot = path.join(__dirname, '../../uploads');
const maxUploadBytes = 15 * 1024 * 1024;

fs.mkdirSync(uploadRoot, { recursive: true });

const sanitizeFilename = (filename = 'file') => {
  const baseName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  return baseName || 'file';
};

const storage = multer.diskStorage({
  destination: uploadRoot,
  filename: (req, file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: maxUploadBytes,
    files: 1
  }
});

const parseMultipartUpload = (req, res, next) => {
  if (!req.headers['content-type']?.startsWith('multipart/form-data')) {
    req.upload = { fields: req.body || {}, file: null };
    next();
    return;
  }

  upload.single('file')(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    req.upload = {
      fields: req.body || {},
      file: req.file ? {
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      } : null
    };
    next();
  });
};

module.exports = {
  maxUploadBytes,
  parseMultipartUpload,
  uploadRoot
};
