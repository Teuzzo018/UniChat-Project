export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'gif',
  'jpeg',
  'jpg',
  'mp3',
  'mp4',
  'ogg',
  'pdf',
  'png',
  'txt',
  'wav',
  'webp',
  'webm',
  'zip'
]);

export const formatBytes = (bytes = 0) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const getFileExtension = (filename = '') => filename.split('.').pop()?.toLowerCase() || '';

export const isImageAttachment = (message) => (
  message.attachmentUrl?.startsWith('/private-uploads/')
  && ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(message.attachmentMimeType)
);

export const isVideoAttachment = (message) => (
  message.attachmentUrl?.startsWith('/private-uploads/')
  && ['video/mp4', 'video/webm'].includes(message.attachmentMimeType)
);

export const isAudioAttachment = (message) => (
  message.attachmentUrl?.startsWith('/private-uploads/')
  && ['audio/mpeg', 'audio/ogg', 'audio/wav'].includes(message.attachmentMimeType)
);

export const isAllowedAttachment = (file) => {
  if (!file) {
    return true;
  }

  return ALLOWED_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name));
};
