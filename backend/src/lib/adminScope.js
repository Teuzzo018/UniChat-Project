const prisma = require('./prisma');
const { canModerateGlobal, isActive } = require('./authorization');

const managedServerWhere = (user) => ({ OR: [
  { ownerId: user.id },
  { members: { some: { userId: user.id, isAdmin: true } } }
] });

const getAdminScope = async (user, db = prisma) => {
  if (!isActive(user)) return null;
  if (canModerateGlobal(user)) return { global: true, serverIds: [] };
  const servers = await db.server.findMany({ where: managedServerWhere(user), select: { id: true } });
  return servers.length ? { global: false, serverIds: servers.map(({ id }) => id) } : null;
};

const requireAdminScope = async (req, res, next) => {
  try {
    req.adminScope = await getAdminScope(req.user);
    if (!req.adminScope) return res.status(403).json({ error: 'Permesso amministrativo richiesto' });
    return next();
  } catch (error) { return next(error); }
};

module.exports = { getAdminScope, managedServerWhere, requireAdminScope };
