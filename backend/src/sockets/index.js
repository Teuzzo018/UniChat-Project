/**
 * ============================================================================
 * HANDLER PRINCIPALE SOCKET.IO (sockets/index.js)
 * 1. Handshake e autenticazione: verifica token di sessione su evento 'authenticate'
 * 2. Registrazione moduli socket: chat, canali vocali, videochiamate, giochi e presenza
 * 3. Gestione disconnessione: notifica offline dello stato agli amici connessi
 * ============================================================================
 */
const registerCallHandlers = require('./callHandlers');
const registerChatHandlers = require('./chatHandlers');
const registerGameHandlers = require('./gameHandlers');
const { getUserFromToken, getUserRoom } = require('./shared');
const registerVoiceHandlers = require('./voiceHandlers');
const presence = require('./presence');

const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`Utente connesso via WebSocket: ${socket.id}`);

    socket.use((packet, next) => {
      if (packet[1] === null) return next(new Error('Payload non valido'));
      return next();
    });

    socket.on('authenticate', async ({ token } = {}, callback) => {
      try {
        const user = await getUserFromToken(token);

        if (!user) {
          if (socket.data.user) {
            socket.disconnect(true);
          }
          callback?.({ ok: false, error: 'Sessione non valida' });
          return;
        }

        if (socket.data.user) {
          if (socket.data.user.id !== user.id) {
            callback?.({ ok: false, error: 'Nuova connessione richiesta' });
            socket.disconnect(true);
            return;
          }
          for (const room of socket.rooms) if (room !== socket.id) socket.leave(room);
          socket.data.channelId = null;
        }
        socket.data.user = user;
        socket.data.token = token;
        const alreadyOnline = await presence.isOnline(io, user.id);
        socket.join(getUserRoom(user.id));
        callback?.({ ok: true, userId: user.id });
        await presence.sendSnapshot(io, socket, user.id);
        if (socket.connected && !alreadyOnline) await presence.announce(io, user.id, true);
      } catch (error) {
        console.error('Errore Socket.IO authenticate:', error);
        callback?.({ ok: false, error: 'Autenticazione socket non riuscita' });
      }
    });

    registerChatHandlers({ io, socket });
    registerVoiceHandlers({ io, socket });
    registerCallHandlers({ io, socket });
    registerGameHandlers({ io, socket });

    socket.on('disconnect', async () => {
      console.log(`Utente disconnesso: ${socket.id}`);
      if (!socket.data.user) return;
      try {
        if (!await presence.isOnline(io, socket.data.user.id)) {
          await presence.announce(io, socket.data.user.id, false);
        }
      } catch (error) { console.error('Presenza non aggiornata:', error.code || error.name); }
    });
  });
};

module.exports = registerSocketHandlers;
