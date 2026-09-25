const { findAccessibleChannel } = require('../controllers/messageControllers');
const { getSocketUserSummary, getUserFromToken, getVoiceRoom } = require('./shared');

const voiceRooms = new Map();

const getVoiceParticipants = (channelId) => {
  const room = voiceRooms.get(channelId);

  if (!room) {
    return [];
  }

  return Array.from(room.values()).map(({ user }) => getSocketUserSummary(user));
};

const leaveVoiceChannel = (io, socket) => {
  const channelId = socket.data.voiceChannelId;

  if (!channelId) {
    return;
  }

  const room = voiceRooms.get(channelId);

  if (room) {
    room.delete(socket.id);
    if (room.size === 0) {
      voiceRooms.delete(channelId);
    }
  }

  socket.leave(getVoiceRoom(channelId));
  socket.data.voiceChannelId = null;

  socket.to(getVoiceRoom(channelId)).emit('voice_peer_left', {
    socketId: socket.id,
    userId: socket.data.user?.id
  });

  io.to(getVoiceRoom(channelId)).emit('voice_participants', {
    channelId,
    participants: getVoiceParticipants(channelId)
  });
};

const registerVoiceHandlers = ({ io, socket }) => {
  socket.on('voice_join_channel', async ({ token, channelId }, callback) => {
    try {
      const user = await getUserFromToken(token);

      if (!user) {
        callback?.({ ok: false, error: 'Sessione non valida' });
        return;
      }

      const channel = await findAccessibleChannel(channelId, user.id);

      if (!channel || channel.type !== 'VOICE') {
        callback?.({ ok: false, error: 'Canale vocale non disponibile' });
        return;
      }

      leaveVoiceChannel(io, socket);

      if (!voiceRooms.has(channelId)) {
        voiceRooms.set(channelId, new Map());
      }

      const existingPeers = Array.from(voiceRooms.get(channelId).entries()).map(([socketId, item]) => ({
        socketId,
        user: getSocketUserSummary(item.user)
      }));

      voiceRooms.get(channelId).set(socket.id, { user });
      socket.data.user = user;
      socket.data.voiceChannelId = channelId;
      socket.join(getVoiceRoom(channelId));

      socket.to(getVoiceRoom(channelId)).emit('voice_peer_joined', {
        socketId: socket.id,
        user: getSocketUserSummary(user)
      });

      io.to(getVoiceRoom(channelId)).emit('voice_participants', {
        channelId,
        participants: getVoiceParticipants(channelId)
      });

      callback?.({
        ok: true,
        peers: existingPeers,
        participants: getVoiceParticipants(channelId)
      });
    } catch (error) {
      console.error('Errore Socket.IO voice_join_channel:', error);
      callback?.({ ok: false, error: 'Ingresso nel canale vocale non riuscito' });
    }
  });

  socket.on('voice_leave_channel', () => {
    leaveVoiceChannel(io, socket);
  });

  socket.on('voice_signal', ({ to, signal }) => {
    if (!to || !signal || !socket.data.voiceChannelId) {
      return;
    }

    io.to(to).emit('voice_signal', {
      from: socket.id,
      user: socket.data.user ? getSocketUserSummary(socket.data.user) : null,
      signal
    });
  });

  socket.on('voice_transcript', ({ channelId, text }) => {
    const activeVoiceChannelId = socket.data.voiceChannelId;
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 500) : '';

    if (!activeVoiceChannelId || channelId !== activeVoiceChannelId || !cleanText || !socket.data.user) {
      return;
    }

    io.to(getVoiceRoom(activeVoiceChannelId)).emit('voice_transcript', {
      id: `${socket.id}:${Date.now()}`,
      channelId: activeVoiceChannelId,
      user: getSocketUserSummary(socket.data.user),
      text: cleanText,
      createdAt: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    leaveVoiceChannel(io, socket);
  });
};

module.exports = registerVoiceHandlers;
