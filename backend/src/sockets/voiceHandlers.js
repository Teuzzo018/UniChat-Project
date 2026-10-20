const { findAccessibleChannel } = require('../controllers/messageControllers');
const { getVoiceRoom } = require('./shared');
const authorizeSocket = require('./authorize');

const leaveVoiceChannel = (io, socket) => {
  const channelId = socket.data.voiceChannelId;

  if (!channelId) {
    return;
  }

  socket.leave(getVoiceRoom(channelId));
  socket.data.voiceChannelId = null;
};

const registerVoiceHandlers = ({ io, socket }) => {
  socket.on('voice_join_channel', async ({ token, channelId } = {}, callback) => {
    try {
      const user = await authorizeSocket(socket, 'user', null, token);

      if (!user) {
        callback?.({ ok: false, error: 'Sessione non valida' });
        return;
      }

      const channel = await findAccessibleChannel(channelId, user.id);

      if (!channel || channel.type !== 'VOICE') {
        callback?.({ ok: false, error: 'Chat vocale non disponibile' });
        return;
      }

      leaveVoiceChannel(io, socket);

      socket.data.user = user;
      socket.data.voiceChannelId = channelId;
      socket.join(getVoiceRoom(channelId));
      callback?.({ ok: true });
    } catch (error) {
      console.error('Errore Socket.IO voice_join_channel:', error);
      callback?.({ ok: false, error: 'Ingresso nella chat vocale non riuscito' });
    }
  });

  socket.on('voice_leave_channel', () => {
    leaveVoiceChannel(io, socket);
  });

  socket.on('disconnect', () => {
    leaveVoiceChannel(io, socket);
  });
};

module.exports = registerVoiceHandlers;
