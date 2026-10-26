/**
 * ============================================================================
 * CONTROLLER AMMINISTRAZIONE E MODERAZIONE (adminControllers.js)
 * 1. Panoramica (getAdminOverview): aggregazione dati per i cruscotti di gestione
 * 2. Moderazione (suspendUser / deleteUser): sospensione account o eliminazione definitiva
 * 3. Audit log (getAuditLogs): lettura e filtraggio del registro delle azioni eseguite
 * ============================================================================
 */
const prisma = require('../lib/prisma');
const disconnectUserSockets = require('../utils/disconnectUserSockets');
const { lockRoles } = require('../lib/roleManagement');
const { isSuperadmin } = require('../lib/authorization');
const { canModerateServer, canModerateGlobal } = require('../lib/authorization');

const pageOptions = (query) => {
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page, 10) || 1));
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

const searchTerm = (value) => typeof value === 'string' ? value.trim().slice(0, 80) : '';

const listOverview = async (req, res) => {
  const { page, pageSize, skip } = pageOptions(req.query);
  const q = searchTerm(req.query.q);
  const scope = req.adminScope;
  const userWhere = {
    ...(scope.global ? {} : { servers: { some: { serverId: { in: scope.serverIds } } } }),
    ...(q ? { OR: [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } }
    ] } : {})
  };
  const serverWhere = scope.global ? {} : { id: { in: scope.serverIds } };
  const [users, userCount, servers] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: {
          ownedServers: true,
          servers: { where: { isAdmin: true } }
        } },
        university: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.user.count({ where: userWhere }),
    prisma.server.findMany({
      where: serverWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        ownerId: true,
        members: { select: { isAdmin: true, user: { select: { id: true, fullName: true } } } },
        channels: { select: { id: true, name: true, type: true } },
        owner: {
          select: {
            fullName: true
          }
        },
        university: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            members: true,
            channels: true
          }
        }
      }
    })
  ]);

  return res.status(200).json({ users, servers, pagination: {
    page, pageSize, total: userCount, pages: Math.ceil(userCount / pageSize)
  }, capabilities: { global: scope.global, superadmin: isSuperadmin(req.user) } });
};

const listAudit = async (req, res) => {
  const { page, pageSize, skip } = pageOptions(req.query);
  const where = req.adminScope.global ? {} : { serverId: { in: req.adminScope.serverIds } };
  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: pageSize }),
    prisma.adminAuditLog.count({ where })
  ]);
  return res.status(200).json({ entries, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
};

const deleteServer = async (req, res) => {
  const server = await prisma.server.findUnique({ where: { id: req.params.id }, select: { id: true, ownerId: true } });
  if (!server) return res.status(404).json({ error: 'Server non trovato' });
  if (!canModerateGlobal(req.user) && server.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Permesso eliminazione server richiesto' });
  }
  await prisma.$transaction([
    prisma.serverMember.deleteMany({
      where: { serverId: req.params.id }
    }),
    prisma.server.delete({
      where: { id: req.params.id }
    })
  ]);

  return res.status(200).json({ message: 'Server eliminato' });
};

const updateServer = async (req, res) => {
  const name = req.body?.name;
  const description = req.body?.description;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 ||
      (description != null && (typeof description !== 'string' || description.length > 1000))) {
    return res.status(400).json({ error: 'Dati server non validi' });
  }
  if (!await canModerateServer(req.user, req.params.id)) return res.status(403).json({ error: 'Permesso server richiesto' });
  const server = await prisma.server.update({ where: { id: req.params.id }, data: {
    name: name.trim(), description: description?.trim() || null
  }, select: { id: true, name: true, description: true } });
  return res.status(200).json(server);
};

const notifyServerMembers = async (req, serverId, event, payload) => {
  const io = req.app.get('io');
  if (!io) return;
  try {
    const members = await prisma.serverMember.findMany({ where: { serverId }, select: { userId: true } });
    io.to(members.map(({ userId }) => `user:${userId}`)).emit(event, payload);
  } catch (error) {
    console.error('Aggiornamento canale non notificato:', error.code || error.name);
  }
};

const updateChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  const name = req.body?.name;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ error: 'Il nome del canale deve contenere tra 2 e 80 caratteri' });
  }
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, serverId: true } });
  if (!channel || channel.serverId !== serverId) return res.status(404).json({ error: 'Canale non trovato' });
  if (!await canModerateServer(req.user, serverId)) return res.status(403).json({ error: 'Permesso server richiesto' });
  const updated = await prisma.channel.update({ where: { id: channelId }, data: {
    name: name.trim().toLowerCase().replace(/\s+/g, '-')
  }, select: { id: true, serverId: true, name: true, type: true } });
  await notifyServerMembers(req, serverId, 'channel_updated', updated);
  return res.status(200).json(updated);
};

const deleteChannel = async (req, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId }, select: { id: true, serverId: true } });
  if (!channel || channel.serverId !== req.params.serverId) return res.status(404).json({ error: 'Canale non trovato' });
  if (!await canModerateServer(req.user, channel.serverId)) return res.status(403).json({ error: 'Permesso server richiesto' });
  await prisma.channel.delete({ where: { id: channel.id } });
  req.app.get('io')?.to(`channel:${channel.id}`).emit('channel_deleted', { id: channel.id, serverId: channel.serverId });
  await notifyServerMembers(req, channel.serverId, 'channel_deleted', { id: channel.id, serverId: channel.serverId });
  return res.status(200).json({ message: 'Canale eliminato' });
};

const deleteUser = async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Non puoi eliminare il tuo account admin da qui' });
  }
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const actor = await tx.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, role: true, suspendedAt: true } });
    if (!isSuperadmin(actor)) return { status: 403, error: 'Permesso superadmin richiesto' };
    const target = await tx.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!target) return { status: 404, error: 'Utente non trovato' };
    if (target.role === 'SUPERADMIN') return { status: 403, error: 'Demotare il superadmin prima di eliminarlo' };
    const ownedServers = await tx.server.findMany({ where: { ownerId: target.id }, select: { id: true } });
    const ownedServerIds = ownedServers.map((server) => server.id);
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.message.deleteMany({ where: { userId: target.id } });
    await tx.serverMember.deleteMany({ where: { OR: [
      { userId: target.id }, { serverId: { in: ownedServerIds } }
    ] } });
    await tx.server.deleteMany({ where: { id: { in: ownedServerIds } } });
    await tx.user.delete({ where: { id: target.id } });
    return { status: 200 };
  });
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  await disconnectUserSockets(req.app, req.params.id);

  return res.status(200).json({ message: 'Utente eliminato' });
};

module.exports = {
  deleteChannel,
  deleteServer,
  deleteUser,
  listAudit,
  listOverview,
  updateChannel,
  updateServer
};
