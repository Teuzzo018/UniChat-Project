/**
 * ============================================================================
 * DISCONNESSIONE FORZATA SOCKET (disconnectUserSockets.js)
 * 1. Revoca immediata: chiusura forzata di tutte le socket collegate a un utente sospeso
 * ============================================================================
 */
module.exports = async (app, userId) => {
  const io = app.get('io');
  if (!io) return;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  sockets.forEach((socket) => socket.disconnect(true));
};
