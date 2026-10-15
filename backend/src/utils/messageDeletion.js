const fs = require('node:fs/promises');
const path = require('node:path');
const prisma = require('../lib/prisma');
const { uploadRoot } = require('./uploadParser');
const { privateUploadRoot, privateUrlPrefix, internalName } = require('./privateAttachments');

const clearMessage = {
  content: '',
  attachmentUrl: null,
  attachmentName: null,
  attachmentMimeType: null,
  attachmentSize: null
};

const cleanupAttachment = async (url) => {
  if (typeof url !== 'string') return;
  const privateFile = url.startsWith(privateUrlPrefix);
  const match = privateFile ? /^\/private-uploads\/([a-f0-9]{32})$/.exec(url)
    : /^\/uploads\/([a-zA-Z0-9._-]+)$/.exec(url);
  if (!match || match[1] === '.' || match[1] === '..' || (privateFile && !internalName(match[1]))) return;
  try {
    const [channelUses, privateUses, avatarUses] = await Promise.all([
      prisma.message.count({ where: { attachmentUrl: url } }),
      prisma.privateMessage.count({ where: { attachmentUrl: url } }),
      prisma.user.count({ where: { avatarUrl: url } })
    ]);
    if (channelUses + privateUses + avatarUses > 0) return;
    await fs.unlink(path.join(privateFile ? privateUploadRoot : uploadRoot, match[1]));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Pulizia allegato non riuscita:', error.code || error.name);
    }
  }
};

const tombstoneChannelMessage = async (message, actorId) => {
  if (message.deletedAt) return { alreadyDeleted: true, deletedAt: message.deletedAt };
  const deletedAt = new Date();
  const result = await prisma.message.updateMany({
    where: { id: message.id, channelId: message.channelId, deletedAt: null },
    data: { ...clearMessage, deletedAt, deletedById: actorId }
  });
  if (result.count !== 1) return { alreadyDeleted: true };
  await cleanupAttachment(message.attachmentUrl);
  return { alreadyDeleted: false, deletedAt };
};

const tombstonePrivateMessage = async (message, actorId) => {
  if (message.deletedAt) return { alreadyDeleted: true, deletedAt: message.deletedAt };
  const deletedAt = new Date();
  const result = await prisma.privateMessage.updateMany({
    where: { id: message.id, senderId: actorId, deletedAt: null },
    data: { ...clearMessage, deletedAt, deletedById: actorId }
  });
  if (result.count !== 1) return { alreadyDeleted: true };
  await cleanupAttachment(message.attachmentUrl);
  return { alreadyDeleted: false, deletedAt };
};

module.exports = { cleanupAttachment, tombstoneChannelMessage, tombstonePrivateMessage };
