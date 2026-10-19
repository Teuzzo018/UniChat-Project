const prisma = require('../lib/prisma');
const { canModerateGlobal, isSuperadmin } = require('../lib/authorization');
const { canAffectUser, isLastActiveSuperadmin, isLastSuperadmin, lockRoles } = require('../lib/roleManagement');
const disconnectUserSockets = require('../utils/disconnectUserSockets');

const assignableRoles = new Set(['STUDENT', 'PROFESSOR', 'PLATFORM_ADMIN']);
const userRoleSelect = { id: true, email: true, role: true, suspendedAt: true };

const changeRole = async (req, res) => {
  const role = req.body?.role;
  if (!assignableRoles.has(role) || req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Modifica ruolo non valida' });
  }
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const actor = await tx.user.findUnique({ where: { id: req.user.id }, select: userRoleSelect });
    if (!canModerateGlobal(actor)) return { status: 403, error: 'Permesso admin richiesto' };
    const target = await tx.user.findUnique({ where: { id: req.params.id }, select: userRoleSelect });
    if (!target) return { status: 404, error: 'Utente non trovato' };
    if (target.role === 'SUPERADMIN') return { status: 403, error: 'Il ruolo del proprietario non può essere modificato' };
    if (!isSuperadmin(actor) && (role === 'PLATFORM_ADMIN' || !['STUDENT', 'PROFESSOR'].includes(target.role))) {
      return { status: 403, error: 'Solo il proprietario può gestire gli Admin' };
    }
    if (target.role === role) return { status: 200, user: target };
    if (await isLastSuperadmin(target, tx)) return { status: 409, error: 'Ultimo superadmin protetto' };
    const user = await tx.user.update({ where: { id: target.id }, data: { role }, select: userRoleSelect });
    await tx.session.deleteMany({ where: { userId: target.id } });
    return { status: 200, user };
  });
  if (result.user && result.user.id !== req.user.id) await disconnectUserSockets(req.app, result.user.id);
  return res.status(result.status).json(result.user || { error: result.error });
};

const setServerAdmin = async (req, res) => {
  const { serverId, userId } = req.params;
  if (userId === req.user.id) return res.status(400).json({ error: 'Autoassegnazione non consentita' });
  const enabled = req.method === 'PUT';
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const actor = await tx.user.findUnique({ where: { id: req.user.id }, select: userRoleSelect });
    if (!isSuperadmin(actor)) return { status: 403, error: 'Permesso superadmin richiesto' };
    const server = await tx.server.findUnique({ where: { id: serverId }, select: { id: true, ownerId: true } });
    if (!server) return { status: 404, error: 'Server non trovato' };
    if (server.ownerId === userId) return { status: 409, error: 'Il proprietario ha già privilegi locali' };
    const membership = await tx.serverMember.findUnique({ where: { userId_serverId: { userId, serverId } } });
    if (!membership) return { status: 404, error: 'Utente non membro del server' };
    const target = await tx.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } });
    if (enabled && target?.suspendedAt) return { status: 409, error: 'Utente sospeso' };
    const admin = await tx.serverMember.update({ where: { id: membership.id }, data: { isAdmin: enabled }, select: { userId: true, serverId: true, isAdmin: true } });
    return { status: 200, admin };
  });
  if (result.admin) await disconnectUserSockets(req.app, userId);
  return res.status(result.status).json(result.admin || { error: result.error });
};

const setSuspension = async (req, res) => {
  const suspended = req.method === 'POST';
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const actor = await tx.user.findUnique({ where: { id: req.user.id }, select: userRoleSelect });
    if (!canModerateGlobal(actor)) return { status: 403, error: 'Permesso globale richiesto' };
    const target = await tx.user.findUnique({ where: { id: req.params.id }, select: userRoleSelect });
    if (!target) return { status: 404, error: 'Utente non trovato' };
    if (!await canAffectUser(actor, target, tx)) return { status: 403, error: 'Utente fuori ambito' };
    if (suspended && await isLastActiveSuperadmin(target, tx)) return { status: 409, error: 'Ultimo superadmin attivo protetto' };
    const user = await tx.user.update({
      where: { id: target.id }, data: { suspendedAt: suspended ? new Date() : null }, select: userRoleSelect
    });
    if (suspended) await tx.session.deleteMany({ where: { userId: target.id } });
    return { status: 200, user };
  });
  if (result.user && suspended) await disconnectUserSockets(req.app, result.user.id);
  return res.status(result.status).json(result.user || { error: result.error });
};

module.exports = { changeRole, setServerAdmin, setSuspension };
