const registerCallHandlers = require('./callHandlers');
const registerChatHandlers = require('./chatHandlers');
const registerGameHandlers = require('./gameHandlers');
const { getUserFromToken, getUserRoom } = require('./shared');
const registerVoiceHandlers = require('./voiceHandlers');

const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`Utente connesso via WebSocket: ${socket.id}`);

    socket.on('authenticate', async ({ token }, callback) => {
      try {
        const user = await getUserFromToken(token);

        if (!user) {
          callback?.({ ok: false, error: 'Sessione non valida' });
          return;
        }

        socket.data.user = user;
        socket.join(getUserRoom(user.id));
        callback?.({ ok: true, userId: user.id });
      } catch (error) {
        console.error('Errore Socket.IO authenticate:', error);
        callback?.({ ok: false, error: 'Autenticazione socket non riuscita' });
      }
    });

    registerChatHandlers({ io, socket });
    registerVoiceHandlers({ io, socket });
    registerCallHandlers({ io, socket });
    registerGameHandlers({ io, socket });

    socket.on('disconnect', () => {
      console.log(`Utente disconnesso: ${socket.id}`);
    });
  });
};

module.exports = registerSocketHandlers;
