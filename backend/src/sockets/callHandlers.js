const prisma = require('../lib/prisma');
const { getSocketUserSummary, getUserFromToken, getUserRoom } = require('./shared');

const registerCallHandlers = ({ io, socket }) => {
  socket.on('private_video_call_request', async ({ token, recipientId, callId }, callback) => {
    try {
      const user = await getUserFromToken(token);

      if (!user || !recipientId || recipientId === user.id || !callId) {
        callback?.({ ok: false, error: 'Richiesta non valida' });
        return;
      }

      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true }
      });

      if (!recipient) {
        callback?.({ ok: false, error: 'Utente non trovato' });
        return;
      }

      io.to(getUserRoom(recipientId)).emit('private_video_call_incoming', {
        callId,
        from: getSocketUserSummary(user)
      });
      callback?.({ ok: true });
    } catch (error) {
      console.error('Errore Socket.IO private_video_call_request:', error);
      callback?.({ ok: false, error: 'Chiamata non avviata' });
    }
  });

  socket.on('private_video_call_answer', async ({ token, callId, callerId, accepted }, callback) => {
    try {
      const user = await getUserFromToken(token);

      if (!user || !callId || !callerId) {
        callback?.({ ok: false, error: 'Risposta non valida' });
        return;
      }

      io.to(getUserRoom(callerId)).emit('private_video_call_answered', {
        callId,
        accepted: Boolean(accepted),
        from: getSocketUserSummary(user)
      });
      callback?.({ ok: true });
    } catch (error) {
      console.error('Errore Socket.IO private_video_call_answer:', error);
      callback?.({ ok: false, error: 'Risposta alla chiamata non inviata' });
    }
  });

  socket.on('private_video_call_signal', async ({ token, callId, recipientId, signal }) => {
    const user = await getUserFromToken(token);

    if (!user || !callId || !recipientId || !signal) {
      return;
    }

    io.to(getUserRoom(recipientId)).emit('private_video_call_signal', {
      callId,
      from: getSocketUserSummary(user),
      signal
    });
  });

  socket.on('private_video_call_end', async ({ token, callId, recipientId }) => {
    const user = await getUserFromToken(token);

    if (!user || !callId || !recipientId) {
      return;
    }

    io.to(getUserRoom(recipientId)).emit('private_video_call_ended', {
      callId,
      from: { id: user.id }
    });
  });
};

module.exports = registerCallHandlers;
