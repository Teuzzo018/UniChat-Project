/**
 * ============================================================================
 * CONTROLLER MESSAGGI PREFERITI (favoriteControllers.js)
 * 1. Gestione preferiti (listFavorites / toggleFavorite): salvataggio messaggi importanti
 * ============================================================================
 */
const prisma = require('../lib/prisma');
const { findAccessibleChannel, canContact } = require('./messageControllers');

const listFavorites = async (req, res) => {
  const userId = req.user.id;
  const [channelRows, privateRows] = await Promise.all([
    prisma.channelMessageFavorite.findMany({
      where: { userId, message: { deletedAt: null } },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { createdAt: true, message: { select: {
        id: true, content: true, channelId: true, createdAt: true,
        channel: { select: { name: true, server: { select: { name: true } } } },
        user: { select: { fullName: true } }
      } } }
    }),
    prisma.privateMessageFavorite.findMany({
      where: { userId, message: { deletedAt: null } },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { createdAt: true, message: { select: {
        id: true, content: true, senderId: true, recipientId: true, createdAt: true,
        sender: { select: { fullName: true } }
      } } }
    })
  ]);
  const channelAccess = new Map();
  const privateAccess = new Map();
  const results = [];
  for (const row of channelRows) {
    const message = row.message;
    if (!channelAccess.has(message.channelId)) {
      channelAccess.set(message.channelId, Boolean(await findAccessibleChannel(message.channelId, userId)));
    }
    if (channelAccess.get(message.channelId)) results.push({
      kind: 'channel', id: message.id, createdAt: row.createdAt,
      author: message.user.fullName, content: message.content,
      location: `${message.channel.server.name} · #${message.channel.name}`
    });
  }
  for (const row of privateRows) {
    const message = row.message;
    const peerId = message.senderId === userId ? message.recipientId : message.senderId;
    if (!privateAccess.has(peerId)) privateAccess.set(peerId, await canContact(userId, peerId));
    if (privateAccess.get(peerId)) results.push({
      kind: 'private', id: message.id, createdAt: row.createdAt,
      author: message.sender.fullName, content: message.content,
      location: 'Conversazione privata'
    });
  }
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json(results.slice(0, 100));
};

const changeFavorite = async (req, res) => {
  const { kind, messageId } = req.params;
  const userId = req.user.id;
  if (!['channel', 'private'].includes(kind)) return res.status(404).json({ error: 'Messaggio non trovato' });
  const model = kind === 'channel' ? prisma.channelMessageFavorite : prisma.privateMessageFavorite;
  if (req.method === 'DELETE') {
    await model.deleteMany({ where: { userId, messageId } });
    return res.json({ favorite: false });
  }
  if (kind === 'channel') {
    const message = await prisma.message.findUnique({ where: { id: messageId }, select: { channelId: true, deletedAt: true } });
    if (!message || message.deletedAt || !await findAccessibleChannel(message.channelId, userId)) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
  } else {
    const message = await prisma.privateMessage.findUnique({ where: { id: messageId }, select: {
      senderId: true, recipientId: true, deletedAt: true
    } });
    const peerId = message?.senderId === userId ? message?.recipientId : message?.recipientId === userId ? message?.senderId : null;
    if (!peerId || message.deletedAt || !await canContact(userId, peerId)) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
  }
  await model.upsert({ where: { userId_messageId: { userId, messageId } },
    create: { userId, messageId }, update: {} });
  return res.json({ favorite: true });
};

module.exports = { listFavorites, changeFavorite };
