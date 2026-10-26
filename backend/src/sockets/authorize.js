/**
 * ============================================================================
 * AUTORIZZAZIONI AZIONI SOCKET (sockets/authorize.js)
 * 1. Verifica permessi realtime: controllo ruoli e appartenenze per eventi socket
 * ============================================================================
 */
const { getAuthenticatedSocketUser } = require('./shared');
const { canManageServer, canModerateGlobal, canModerateServer, isSuperadmin } = require('../lib/authorization');

const authorizeSocket = async (socket, permission, serverId, token) => {
  const user = await getAuthenticatedSocketUser(socket, token);
  if (!user) return null;
  if (permission === 'user') return user;
  if (permission === 'globalModeration') return canModerateGlobal(user) ? user : null;
  if (permission === 'roles') return isSuperadmin(user) ? user : null;
  if (permission === 'serverManagement') return await canManageServer(user, serverId) ? user : null;
  if (permission === 'serverModeration') return await canModerateServer(user, serverId) ? user : null;
  return null;
};

module.exports = authorizeSocket;
