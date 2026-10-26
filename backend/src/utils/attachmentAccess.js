/**
 * ============================================================================
 * CONTROLLO ACCESSO ALLEGATI (attachmentAccess.js)
 * 1. Verifica diritti: controllo appartenenza al canale o alla chat privata per download
 * ============================================================================
 */
const prisma = require('../lib/prisma');
const { canContact } = require('../controllers/messageControllers');

const findAuthorizedAttachment = async (url, userId) => {
  const [channelMessage, privateMessage] = await Promise.all([
    prisma.message.findFirst({
      where: { attachmentUrl: url, deletedAt: null, channel: { server: { members: { some: { userId } } } } },
      select: { attachmentName: true, attachmentMimeType: true }
    }),
    prisma.privateMessage.findFirst({
      where: { attachmentUrl: url, deletedAt: null, OR: [{ senderId: userId }, { recipientId: userId }] },
      select: { attachmentName: true, attachmentMimeType: true, senderId: true, recipientId: true }
    })
  ]);
  if (channelMessage) return channelMessage;
  if (!privateMessage) return null;
  const peerId = privateMessage.senderId === userId ? privateMessage.recipientId : privateMessage.senderId;
  return await canContact(userId, peerId) ? privateMessage : null;
};

module.exports = findAuthorizedAttachment;
