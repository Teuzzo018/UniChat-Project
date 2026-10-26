// 1. Limite massimo dimensione allegato (25 MB)
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// 2. Set di estensioni consentite per gli allegati
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

// 3. Formattazione leggibile dei byte (B, KB, MB)
export const formatBytes = (bytes = 0) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// 4. Estrazione estensione file da un nome file
export const getFileExtension = (filename = '') => filename.split('.').pop()?.toLowerCase() || '';

// 5. Verifica se l'allegato è un'immagine supportata
export const isImageAttachment = (message) => (
  message.attachmentUrl?.startsWith('/private-uploads/')
  && ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(message.attachmentMimeType)
);

// 6. Verifica se l'allegato è un video supportato
export const isVideoAttachment = (message) => (
  message.attachmentUrl?.startsWith('/private-uploads/')
  && ['video/mp4', 'video/webm'].includes(message.attachmentMimeType)
);

// 7. Verifica se l'allegato è un file audio supportato
export const isAudioAttachment = (message) => (
  message.attachmentUrl?.startsWith('/private-uploads/')
  && ['audio/mpeg', 'audio/ogg', 'audio/wav'].includes(message.attachmentMimeType)
);

// 8. Controllo client-side di conformità dell'estensione del file selezionato
export const isAllowedAttachment = (file) => {
  if (!file) {
    return true;
  }

  return ALLOWED_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name));
};

