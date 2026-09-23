const crypto = require('crypto');

const prisma = require('../lib/prisma');
const { findAccessibleChannel, messageSelect } = require('../controllers/messageControllers');
const { ensureServerMember } = require('../controllers/serverControllers');
const { hashSessionToken } = require('../utils/sessionTokens');

const games = new Map();
const voiceRooms = new Map();
const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const getUserFromToken = async (token) => {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
};

const getUserRoom = (userId) => `user:${userId}`;
const getVoiceRoom = (channelId) => `voice:${channelId}`;

const getVoiceParticipants = (channelId) => {
  const room = voiceRooms.get(channelId);

  if (!room) {
    return [];
  }

  return Array.from(room.values()).map(({ user }) => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl
  }));
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

const getGameResult = (board) => {
  const winningLine = winningLines.find(([a, b, c]) => {
    return board[a] && board[a] === board[b] && board[a] === board[c];
  });

  if (winningLine) {
    return { winner: board[winningLine[0]], winningLine };
  }

  if (board.every(Boolean)) {
    return { winner: 'draw', winningLine: [] };
  }

  return { winner: null, winningLine: [] };
};

const getGameView = (game) => ({
  id: game.id,
  status: game.status,
  board: game.board,
  turn: game.turn,
  winner: game.winner,
  winningLine: game.winningLine,
  players: game.players,
  serverId: game.serverId
});

const emitGameUpdate = (io, game) => {
  const payload = getGameView(game);

  game.players.forEach((player) => {
    io.to(getUserRoom(player.id)).emit('private_game_update', payload);
  });
};

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

    socket.on('join_channel', (channelId) => {
      socket.join(channelId);
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

        io.to(channelId).emit('message_created', message);
        callback?.({ ok: true, message });
      } catch (error) {
        console.error('Errore Socket.IO send_message:', error);
        callback?.({ ok: false, error: 'Errore durante l\'invio' });
      }
    });

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
          user: {
            id: item.user.id,
            username: item.user.username,
            fullName: item.user.fullName,
            avatarUrl: item.user.avatarUrl
          }
        }));

        voiceRooms.get(channelId).set(socket.id, { user });
        socket.data.user = user;
        socket.data.voiceChannelId = channelId;
        socket.join(getVoiceRoom(channelId));

        socket.to(getVoiceRoom(channelId)).emit('voice_peer_joined', {
          socketId: socket.id,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl
          }
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
        user: socket.data.user ? {
          id: socket.data.user.id,
          username: socket.data.user.username,
          fullName: socket.data.user.fullName,
          avatarUrl: socket.data.user.avatarUrl
        } : null,
        signal
      });
    });

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
          from: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl
          }
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
          from: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl
          }
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
        from: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl
        },
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

    socket.on('private_game_request', async ({ token, opponentId, serverId }, callback) => {
      try {
        const user = await getUserFromToken(token);

        if (!user || !opponentId || !serverId || opponentId === user.id) {
          callback?.({ ok: false, error: 'Richiesta non valida' });
          return;
        }

        const [requesterMember, opponentMember, opponent] = await Promise.all([
          ensureServerMember(serverId, user.id),
          ensureServerMember(serverId, opponentId),
          prisma.user.findUnique({
            where: { id: opponentId },
            select: { id: true, fullName: true, avatarUrl: true }
          })
        ]);

        if (!requesterMember || !opponentMember || !opponent) {
          callback?.({ ok: false, error: 'Utente non disponibile in questo server' });
          return;
        }

        const game = {
          id: crypto.randomUUID(),
          serverId,
          status: 'pending',
          board: Array(9).fill(null),
          turn: 'X',
          winner: null,
          winningLine: [],
          players: [
            { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl, symbol: 'X' },
            { id: opponent.id, fullName: opponent.fullName, avatarUrl: opponent.avatarUrl, symbol: 'O' }
          ]
        };

        games.set(game.id, game);
        io.to(getUserRoom(opponent.id)).emit('private_game_invite', getGameView(game));
        callback?.({ ok: true, game: getGameView(game) });
      } catch (error) {
        console.error('Errore Socket.IO private_game_request:', error);
        callback?.({ ok: false, error: 'Impossibile creare la partita' });
      }
    });

    socket.on('private_game_accept', async ({ token, gameId, accepted }, callback) => {
      try {
        const user = await getUserFromToken(token);
        const game = games.get(gameId);

        if (!user || !game || game.status !== 'pending') {
          callback?.({ ok: false, error: 'Partita non disponibile' });
          return;
        }

        const invitedPlayer = game.players[1];

        if (invitedPlayer.id !== user.id) {
          callback?.({ ok: false, error: 'Non puoi rispondere a questa partita' });
          return;
        }

        if (!accepted) {
          games.delete(game.id);
          game.status = 'declined';
          emitGameUpdate(io, game);
          callback?.({ ok: true, game: getGameView(game) });
          return;
        }

        game.status = 'active';
        emitGameUpdate(io, game);
        callback?.({ ok: true, game: getGameView(game) });
      } catch (error) {
        console.error('Errore Socket.IO private_game_accept:', error);
        callback?.({ ok: false, error: 'Risposta alla partita non riuscita' });
      }
    });

    socket.on('private_game_move', async ({ token, gameId, index }, callback) => {
      try {
        const user = await getUserFromToken(token);
        const game = games.get(gameId);
        const player = game?.players.find((item) => item.id === user?.id);

        if (!user || !game || !player || game.status !== 'active') {
          callback?.({ ok: false, error: 'Partita non disponibile' });
          return;
        }

        if (!Number.isInteger(index) || index < 0 || index > 8 || game.board[index]) {
          callback?.({ ok: false, error: 'Mossa non valida' });
          return;
        }

        if (player.symbol !== game.turn) {
          callback?.({ ok: false, error: 'Non e il tuo turno' });
          return;
        }

        game.board[index] = player.symbol;

        const result = getGameResult(game.board);
        game.winner = result.winner;
        game.winningLine = result.winningLine;

        if (game.winner) {
          game.status = 'finished';
        } else {
          game.turn = game.turn === 'X' ? 'O' : 'X';
        }

        emitGameUpdate(io, game);
        callback?.({ ok: true, game: getGameView(game) });
      } catch (error) {
        console.error('Errore Socket.IO private_game_move:', error);
        callback?.({ ok: false, error: 'Mossa non registrata' });
      }
    });

    socket.on('private_game_restart', async ({ token, gameId }, callback) => {
      try {
        const user = await getUserFromToken(token);
        const game = games.get(gameId);
        const player = game?.players.find((item) => item.id === user?.id);

        if (!user || !game || !player) {
          callback?.({ ok: false, error: 'Partita non disponibile' });
          return;
        }

        game.status = 'active';
        game.board = Array(9).fill(null);
        game.turn = 'X';
        game.winner = null;
        game.winningLine = [];

        emitGameUpdate(io, game);
        callback?.({ ok: true, game: getGameView(game) });
      } catch (error) {
        console.error('Errore Socket.IO private_game_restart:', error);
        callback?.({ ok: false, error: 'Riavvio partita non riuscito' });
      }
    });

    socket.on('disconnect', () => {
      leaveVoiceChannel(io, socket);
      console.log(`Utente disconnesso: ${socket.id}`);
    });
  });
};

module.exports = registerSocketHandlers;
