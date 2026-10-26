/**
 * ============================================================================
 * ROTTE NOTIFICHE (/api/notifications)
 * 1. Contatori messaggi non letti e marcatura lettura conversazioni
 * ============================================================================
 */
const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const { findAccessibleChannel, canContact } = require('../controllers/messageControllers');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(authMiddleware);

router.get('/unread', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [memberships, reads, friendships] = await Promise.all([
    prisma.serverMember.findMany({ where: { userId }, select: { server: { select: { channels: { where: { type: 'TEXT' }, select: { id: true } } } } } }),
    prisma.conversationRead.findMany({ where: { userId } }),
    prisma.friendship.findMany({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] }, select: { requesterId: true, addresseeId: true } })
  ]);
  const readMap = new Map(reads.map((read) => [`${read.kind}:${read.targetId}`, read.readAt]));
  const channels = memberships.flatMap(({ server }) => server.channels.map(({ id }) => id));
  const peers = friendships.map((friendship) => friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId);
  const [channelCounts, privateCounts] = await Promise.all([
    Promise.all(channels.map(async (id) => [id, await prisma.message.count({ where: { channelId: id, userId: { not: userId }, deletedAt: null, ...(readMap.has(`channel:${id}`) ? { createdAt: { gt: readMap.get(`channel:${id}`) } } : {}) } })])),
    Promise.all(peers.map(async (id) => [id, await prisma.privateMessage.count({ where: { senderId: id, recipientId: userId, kind: 'USER', deletedAt: null, ...(readMap.has(`private:${id}`) ? { createdAt: { gt: readMap.get(`private:${id}`) } } : {}) } })]))
  ]);
  res.json({ channels: Object.fromEntries(channelCounts), private: Object.fromEntries(privateCounts) });
}));

router.put('/read/:kind/:targetId', asyncHandler(async (req, res) => {
  const { kind, targetId } = req.params;
  if (kind !== 'channel' && kind !== 'private') return res.status(400).json({ error: 'Tipo conversazione non valido' });
  const accessible = kind === 'channel'
    ? await findAccessibleChannel(targetId, req.user.id)
    : targetId !== req.user.id && await canContact(req.user.id, targetId);
  if (!accessible) return res.status(404).json({ error: 'Conversazione non disponibile' });
  const through = new Date(req.body?.through);
  if (Number.isNaN(through.getTime())) return res.status(400).json({ error: 'Data non valida' });
  const readAt = new Date(Math.min(through.getTime(), Date.now()));
  await prisma.conversationRead.createMany({ data: [{ userId: req.user.id, kind, targetId, readAt }], skipDuplicates: true });
  await prisma.conversationRead.updateMany({
    where: { userId: req.user.id, kind, targetId, readAt: { lt: readAt } },
    data: { readAt }
  });
  res.json({ readAt });
}));

module.exports = router;
