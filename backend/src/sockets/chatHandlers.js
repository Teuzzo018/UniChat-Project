const prisma = require('../lib/prisma');
const { findAccessibleChannel, messageSelect } = require('../controllers/messageControllers');
const { getChannelRoom, getUserFromToken } = require('./shared');

const registerChatHandlers = ({ io, socket }) => {
  socket.on('join_channel', (channelId) => {
    if (!channelId) {
      return;
    }

    socket.join(getChannelRoom(channelId));
    console.log(`Socket ${socket.id} entrato nel canale ${channelId}`);
  });

  socket.on('send_message', async ({ token, channelId, content }, callback) => {
    try {
      const user = await getUserFromToken(token);

      if (!user) {
        callback?.({ ok: false, error: 'Sessione non valida' });
        return;
      }

      const channel = await findAccessibleChannel(channelId, user.id);

      if (!channel || channel.type !== 'TEXT') {
        callback?.({ ok: false, error: 'Canale non disponibile' });
        return;
      }

      if (!content || content.trim().length === 0) {
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
      callback?.({ ok: true, message });
    } catch (error) {
      console.error('Errore Socket.IO send_message:', error);
      callback?.({ ok: false, error: 'Errore durante l\'invio' });
    }
  });
};

module.exports = registerChatHandlers;
