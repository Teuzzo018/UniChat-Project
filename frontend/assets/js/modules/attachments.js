export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'avif',
  'aac',
  'doc',
  'docx',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'm4a',
  'm4v',
  'mov',
  'mp3',
  'mp4',
  'ogg',
  'pdf',
  'png',
  'ppt',
  'pptx',
  'txt',
  'wav',
  'webp',
  'xls',
  'xlsx',
  'zip'
]);

const IMAGE_ATTACHMENT_EXTENSIONS = new Set(['avif', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_ATTACHMENT_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);
const AUDIO_ATTACHMENT_EXTENSIONS = new Set(['aac', 'm4a', 'mp3', 'ogg', 'wav', 'webm']);

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

const getAttachmentExtension = (message) => getFileExtension(message.attachmentName || message.attachmentUrl || '');

export const isImageAttachment = (message) => (
  message.attachmentMimeType?.startsWith('image/')
  || IMAGE_ATTACHMENT_EXTENSIONS.has(getAttachmentExtension(message))
);

export const isVideoAttachment = (message) => (
  message.attachmentMimeType?.startsWith('video/')
  || VIDEO_ATTACHMENT_EXTENSIONS.has(getAttachmentExtension(message))
);

export const isAudioAttachment = (message) => (
  message.attachmentMimeType?.startsWith('audio/')
  || AUDIO_ATTACHMENT_EXTENSIONS.has(getAttachmentExtension(message))
);

export const isAllowedAttachment = (file) => {
  if (!file) {
    return true;
  }

  if (file.type?.startsWith('image/') || file.type?.startsWith('audio/') || file.type?.startsWith('video/')) {
    return true;
  }

  return ALLOWED_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name));
};
