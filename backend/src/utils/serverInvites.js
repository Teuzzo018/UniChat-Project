const parseInviteCode = (input) => {
  if (typeof input !== 'string' || input.length > 2048) return null;
  let value = input.trim();
  if (value.includes('://')) {
    try { value = new URL(value).searchParams.get('invite') || ''; }
    catch { return null; }
  }
  return /^[a-f0-9]{12}$|^[a-f0-9]{32}$/i.test(value) ? value.toLowerCase() : null;
};

const inviteError = () => Object.assign(new Error('Invito non valido, scaduto o esaurito'), { statusCode: 404 });
const isInviteCurrent = (server, now = new Date()) => Boolean(server && !server.inviteRevokedAt &&
  (!server.inviteExpiresAt || server.inviteExpiresAt > now));
const isInviteActive = (server, now = new Date()) => Boolean(isInviteCurrent(server, now) &&
  (server.inviteMaxUses === null || server.inviteMaxUses === undefined || server.inviteUses < server.inviteMaxUses));

const redeemInvite = async (tx, code, userId) => {
  const server = await tx.server.findUnique({ where: { inviteCode: code }, select: {
    id: true, inviteCode: true, inviteExpiresAt: true, inviteMaxUses: true,
    inviteUses: true, inviteRevokedAt: true
  } });
  if (!server) throw inviteError();
  const membership = await tx.serverMember.findUnique({ where: {
    userId_serverId: { userId, serverId: server.id }
  } });
  if (membership) return { serverId: server.id, alreadyMember: true };
  if (!isInviteCurrent(server)) throw inviteError();
  const request = await tx.serverJoinRequest.findUnique({ where: {
    userId_serverId: { userId, serverId: server.id }
  }, select: { id: true, status: true } });
  if (request?.status === 'PENDING') return { serverId: server.id, alreadyPending: true };
  if (!isInviteActive(server)) throw inviteError();

  const now = new Date();
  const reserved = await tx.server.updateMany({ where: {
    id: server.id, inviteCode: code, inviteRevokedAt: null,
    OR: [{ inviteExpiresAt: null }, { inviteExpiresAt: { gt: now } }],
    ...(server.inviteMaxUses == null ? {} : { inviteUses: { lt: server.inviteMaxUses } })
  }, data: { inviteUses: { increment: 1 } } });
  if (!reserved.count) throw inviteError();
  if (request) {
    const changed = await tx.serverJoinRequest.updateMany({
      where: { id: request.id, status: 'DECLINED' }, data: { status: 'PENDING' }
    });
    if (!changed.count) throw Object.assign(new Error('Richiesta modificata'), { code: 'P2034' });
  } else {
    await tx.serverJoinRequest.create({ data: { userId, serverId: server.id } });
  }
  return { serverId: server.id };
};

module.exports = { parseInviteCode, inviteError, isInviteActive, redeemInvite };
