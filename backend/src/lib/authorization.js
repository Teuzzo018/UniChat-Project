const prisma = require('./prisma');

const SITE_OWNER_EMAIL = 'teo.sisto.04@gmail.com';
const globalModeratorRoles = new Set(['ADMIN', 'PLATFORM_ADMIN']);
const privilegedRoles = new Set(['ADMIN', 'PLATFORM_ADMIN', 'SUPERADMIN']);

const isActive = (user) => Boolean(user && !user.suspendedAt);
const isSuperadmin = (user) => isActive(user) && user.role === 'SUPERADMIN' && user.email?.toLowerCase() === SITE_OWNER_EMAIL;
const canModerateGlobal = (user) => isActive(user) && (globalModeratorRoles.has(user.role) || isSuperadmin(user));
const isPrivilegedRole = (role) => privilegedRoles.has(role);

const getServerScope = async (user, serverId, db = prisma) => {
  if (!isActive(user) || typeof serverId !== 'string' || !serverId) return null;
  const server = await db.server.findUnique({ where: { id: serverId }, select: { id: true, ownerId: true } });
  if (!server) return null;
  const membership = await db.serverMember.findUnique({
    where: { userId_serverId: { userId: user.id, serverId } },
    select: { id: true, isAdmin: true }
  });
  return {
    serverId,
    member: Boolean(membership),
    owner: server.ownerId === user.id,
    serverAdmin: Boolean(membership?.isAdmin)
  };
};

const canManageServer = async (user, serverId, db = prisma) => {
  const scope = await getServerScope(user, serverId, db);
  return Boolean(scope && (isSuperadmin(user) || scope.owner || scope.serverAdmin));
};

const canModerateServer = async (user, serverId, db = prisma) => {
  const scope = await getServerScope(user, serverId, db);
  return Boolean(scope && (canModerateGlobal(user) || scope.owner || scope.serverAdmin));
};

const canModerateServerMessages = async (user, serverId, db = prisma) => {
  const scope = await getServerScope(user, serverId, db);
  return Boolean(scope && (scope.owner || scope.serverAdmin));
};

const requireGlobalModerator = (req, res, next) => canModerateGlobal(req.user)
  ? next() : res.status(403).json({ error: 'Permesso globale richiesto' });

const requireSuperadmin = (req, res, next) => isSuperadmin(req.user)
  ? next() : res.status(403).json({ error: 'Permesso superadmin richiesto' });

const requireServerManager = (param = 'id') => async (req, res, next) => {
  try {
    if (!await canManageServer(req.user, req.params[param])) return res.status(403).json({ error: 'Permesso server richiesto' });
    return next();
  } catch (error) { return next(error); }
};

module.exports = {
  SITE_OWNER_EMAIL,
  canManageServer,
  canModerateGlobal,
  canModerateServer,
  canModerateServerMessages,
  getServerScope,
  isActive,
  isPrivilegedRole,
  isSuperadmin,
  requireGlobalModerator,
  requireServerManager,
  requireSuperadmin
};
