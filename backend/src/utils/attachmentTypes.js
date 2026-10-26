/**
 * ============================================================================
 * TIPI ALLEGATI SUPPORTATI (attachmentTypes.js)
 * 1. Whitelist estensioni e mime-type ammessi per l'upload di file
 * ============================================================================
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const signatures = [
  { extensions: ['png'], mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) },
  { extensions: ['jpg', 'jpeg'], mime: 'image/jpeg', test: (b) => b.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) },
  { extensions: ['gif'], mime: 'image/gif', test: (b) => ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6)) },
  { extensions: ['webp'], mime: 'image/webp', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { extensions: ['pdf'], mime: 'application/pdf', test: (b) => b.toString('ascii', 0, 5) === '%PDF-' },
  { extensions: ['zip'], mime: 'application/zip', test: (b) => ['504b0304', '504b0506', '504b0708'].includes(b.subarray(0, 4).toString('hex')) },
  { extensions: ['wav'], mime: 'audio/wav', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE' },
  { extensions: ['ogg'], mime: 'audio/ogg', test: (b) => b.toString('ascii', 0, 4) === 'OggS' },
  { extensions: ['mp3'], mime: 'audio/mpeg', test: (b) => b.toString('ascii', 0, 3) === 'ID3' || (b.length > 1 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { extensions: ['mp4'], mime: 'video/mp4', test: (b) => b.toString('ascii', 4, 8) === 'ftyp' && /^(isom|iso2|mp41|mp42|avc1|M4V )$/.test(b.toString('ascii', 8, 12)) },
  { extensions: ['webm'], mime: 'video/webm', test: (b) => b.subarray(0, 4).toString('hex') === '1a45dfa3' && b.includes(Buffer.from('webm')) }
];

const detectAttachment = async (filePath, originalName) => {
  const extension = path.extname(originalName || '').slice(1).toLowerCase();
  const handle = await fs.open(filePath, 'r');
  let head;
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    head = buffer.subarray(0, bytesRead);
  } finally { await handle.close(); }

  const detected = signatures.find((item) => item.test(head));
  if (detected) return detected.extensions.includes(extension) ? detected.mime : null;
  if (extension !== 'txt') return null;
  const content = await fs.readFile(filePath);
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch { return null; }
  if (content.some((byte) => byte === 0 || (byte < 32 && ![9, 10, 13].includes(byte)))) return null;
  return 'text/plain';
};

module.exports = { detectAttachment };
