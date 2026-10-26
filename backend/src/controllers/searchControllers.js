/**
 * ============================================================================
 * CONTROLLER RICERCA GLOBALE (searchControllers.js)
 * 1. Ricerca full-text (globalSearch): ricerca sicura di messaggi, canali e persone
 * ============================================================================
 */
const prisma = require('../lib/prisma');

const scopes = new Set(['explore', 'member', 'channels', 'users', 'friends']);
const searchGlobal = async (req, res) => {
  const scope = String(req.query.scope || 'explore');
  const q = String(req.query.q || '').trim();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  if (!scopes.has(scope) || q.length > 80 || !Number.isSafeInteger(page) || page < 1 || page > 50 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    return res.status(400).json({ error: 'Parametri di ricerca non validi' });
  }
  if (['users', 'friends'].includes(scope) && q.length < 2) {
    return res.json({ scope, page, items: [], hasMore: false });
  }
  const paging = { skip: (page - 1) * limit, take: limit + 1 };
  const searchTerm = q.replace(/[\\%_]/g, '\\$&');
  const nameMatch = q ? { contains: searchTerm, mode: 'insensitive' } : undefined;
  let rows;
  if (scope === 'explore') {
    rows = req.user.universityId ? await prisma.server.findMany({
      where: { isDiscoverable: true, universityId: req.user.universityId,
        members: { none: { userId: req.user.id } },
        ...(q ? { OR: [{ name: nameMatch }, { description: nameMatch }] } : {}) },
      select: { id: true, name: true, description: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], ...paging
    }) : [];
  } else if (scope === 'member') {
    rows = await prisma.server.findMany({
      where: { members: { some: { userId: req.user.id } }, ...(q ? { name: nameMatch } : {}) },
      select: { id: true, name: true, description: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], ...paging
    });
  } else if (scope === 'channels') {
    rows = await prisma.channel.findMany({
      where: { server: { members: { some: { userId: req.user.id } } },
        ...(q ? { name: nameMatch } : {}) },
      select: { id: true, name: true, type: true, serverId: true,
        server: { select: { id: true, name: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], ...paging
    });
  } else {
    const friendFilter = { OR: [
      { friendshipsStarted: { some: { addresseeId: req.user.id, status: 'ACCEPTED' } } },
      { friendshipsReceived: { some: { requesterId: req.user.id, status: 'ACCEPTED' } } }
    ] };
    rows = await prisma.user.findMany({
      where: { id: { not: req.user.id }, suspendedAt: null,
        blockedUsers: { none: { blockedId: req.user.id } },
        blockedByUsers: { none: { blockerId: req.user.id } },
        ...(scope === 'friends' ? { AND: [friendFilter] } : {}),
        OR: [{ username: nameMatch }, { fullName: nameMatch }]
      },
      select: { id: true, username: true, fullName: true, avatarUrl: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }], ...paging
    });
  }
  return res.json({ scope, page, items: rows.slice(0, limit), hasMore: rows.length > limit });
};

module.exports = { searchGlobal };
