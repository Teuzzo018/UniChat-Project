/**
 * ============================================================================
 * HANDLER SOCKET CHAT (sockets/chatHandlers.js)
 * 1. Invio messaggi: ricezione evento 'send_message', scrittura DB e broadcast nel canale
 * ============================================================================
 */
const prisma = require('../lib/prisma');
const { findAccessibleChannel, messageSelect } = require('../controllers/messageControllers');
const { getChannelRoom } = require('./shared');
const authorizeSocket = require('./authorize');

const registerChatHandlers = ({ io, socket }) => {
  socket.on('join_channel', async (channelId, callback) => {
    try {
      const user = await authorizeSocket(socket, 'user');
      const channel = user && typeof channelId === 'string' && await findAccessibleChannel(channelId, user.id);
      if (!channel || channel.type !== 'TEXT') return callback?.({ ok: false, error: 'Canale non disponibile' });
      if (socket.data.channelId) socket.leave(getChannelRoom(socket.data.channelId));
      socket.data.channelId = channelId;
      socket.join(getChannelRoom(channelId));
      callback?.({ ok: true });
    } catch (error) {
      console.error('Errore Socket.IO join_channel:', error);
      callback?.({ ok: false, error: 'Ingresso non riuscito' });
    }
  });

  socket.on('send_message', async ({ token, channelId, content } = {}, callback) => {
    try {
      const user = await authorizeSocket(socket, 'user', null, token);

      if (!user) {
        callback?.({ ok: false, error: 'Sessione non valida' });
        return;
      }

      const channel = await findAccessibleChannel(channelId, user.id);

      if (!channel || channel.type !== 'TEXT') {
        callback?.({ ok: false, error: 'Canale non disponibile' });
        return;
      }

      if (typeof content !== 'string' || content.trim().length === 0) {
        callback?.({ ok: false, error: 'Il messaggio non puo essere vuoto' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          content: content.trim().slice(0, 1000),
          channelId,
          userId: user.id
        },
        select: messageSelect
      });

      io.to(getChannelRoom(channelId)).emit('message_created', message);
      try {
        const members = await prisma.serverMember.findMany({ where: { serverId: channel.serverId }, select: { userId: true } });
        for (const { userId } of members) io.to(`user:${userId}`).emit('channel_message_notification', message);
      } catch (error) { console.error('Notifica messaggio canale non inviata:', error); }
      callback?.({ ok: true, message });
    } catch (error) {
      console.error('Errore Socket.IO send_message:', error);
      callback?.({ ok: false, error: 'Errore durante l\'invio' });
    }
  });
};

module.exports = registerChatHandlers;
