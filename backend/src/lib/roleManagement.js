const { isPrivilegedRole, isSuperadmin } = require('./authorization');

const lockRoles = (tx) => tx.$queryRaw`SELECT pg_advisory_xact_lock(714293853)::text AS lock`;

const canAffectUser = async (actor, target) => {
  if (!target || actor.id === target.id) return false;
  if (isSuperadmin(actor)) return true;
  return !isPrivilegedRole(target.role);
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
