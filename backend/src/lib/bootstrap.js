const crypto = require('crypto');
const env = require('../config/env');
const { lockRoles } = require('./roleManagement');

const matchesAdminCode = (value) => {
  if (!env.adminSetupCode || typeof value !== 'string') return false;
  const provided = Buffer.from(value);
  const expected = Buffer.from(env.adminSetupCode);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
};

const registrationRole = async (tx, value) => {
  if (!matchesAdminCode(value)) return 'STUDENT';
  await lockRoles(tx);
  const count = await tx.user.count({ where: { role: { in: ['ADMIN', 'PLATFORM_ADMIN', 'SUPERADMIN'] } } });
  return count === 0 ? 'SUPERADMIN' : 'STUDENT';
};

module.exports = { matchesAdminCode, registrationRole };
