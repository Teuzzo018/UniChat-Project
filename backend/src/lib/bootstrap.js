const { lockRoles } = require('./roleManagement');
const { SITE_OWNER_EMAIL } = require('./authorization');

const registrationRole = async (tx, email) => {
  if (email?.trim().toLowerCase() !== SITE_OWNER_EMAIL) return 'STUDENT';
  await lockRoles(tx);
  return 'SUPERADMIN';
};

module.exports = { registrationRole };
