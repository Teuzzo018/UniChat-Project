const prisma = require('./prisma');
const { isPrivilegedRole, isSuperadmin } = require('./authorization');

const lockRoles = (tx) => tx.$queryRaw`SELECT pg_advisory_xact_lock(714293853)`;

const canAffectUser = async (actor, target, db = prisma) => {
  if (!target || actor.id === target.id) return false;
  if (isSuperadmin(actor)) return true;
  if (isPrivilegedRole(target.role)) return false;
  const [ownedServers, managedServers] = await Promise.all([
    db.server.count({ where: { ownerId: target.id } }),
    db.serverMember.count({ where: { userId: target.id, isAdmin: true } })
  ]);
  return ownedServers === 0 && managedServers === 0;
};

const isLastSuperadmin = async (target, tx) => {
  if (target.role !== 'SUPERADMIN') return false;
  return await tx.user.count({ where: { role: 'SUPERADMIN' } }) <= 1;
};

const isLastActiveSuperadmin = async (target, tx) => {
  if (target.role !== 'SUPERADMIN' || target.suspendedAt) return false;
  return await tx.user.count({ where: { role: 'SUPERADMIN', suspendedAt: null } }) <= 1;
};

module.exports = { canAffectUser, isLastActiveSuperadmin, isLastSuperadmin, lockRoles };
