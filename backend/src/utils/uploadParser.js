const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const multer = require('multer');

const uploadRoot = path.join(__dirname, '../../uploads');
const maxUploadBytes = 25 * 1024 * 1024;
const mimeTypesByExtension = {
  avif: 'image/avif',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

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

const getNormalizedMimeType = (file) => {
  if (!file) {
    return null;
  }

  if (file.mimetype && file.mimetype !== 'application/octet-stream') {
    return file.mimetype;
  }

  const extension = path.extname(file.originalname || '').slice(1).toLowerCase();
  return mimeTypesByExtension[extension] || file.mimetype;
};

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
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        error.statusCode = 413;
        error.message = `Allegato troppo grande. Il limite e ${Math.round(maxUploadBytes / 1024 / 1024)} MB.`;
      }

      next(error);
      return;
    }

    req.upload = {
      fields: req.body || {},
      file: req.file ? {
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: getNormalizedMimeType(req.file),
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
