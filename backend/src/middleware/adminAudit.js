const prisma = require('../lib/prisma');

const audit = (action, resourceType, resourceParam, serverParam) => (req, res, next) => {
  res.once('finish', () => {
    if (!req.user?.id) return;
    const outcome = res.statusCode < 400 ? 'SUCCESS' : res.statusCode === 403 ? 'DENIED' : 'ERROR';
    prisma.adminAuditLog.create({ data: {
      actorId: req.user.id,
      action,
      resourceType,
      resourceId: String(resourceParam === 'self' ? req.user.id : req.params[resourceParam] || ''),
      serverId: serverParam ? String(req.params[serverParam] || '') : req.auditServerId || null,
      outcome
    } }).catch((error) => console.error('Registrazione operazione amministrativa fallita:', error.code || error.name));
  });
  next();
};

module.exports = audit;
