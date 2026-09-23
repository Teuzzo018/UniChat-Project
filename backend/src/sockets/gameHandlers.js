const crypto = require('crypto');

const prisma = require('../lib/prisma');
const { ensureServerMember } = require('../controllers/serverControllers');
const { getSocketUserSummary, getUserFromToken, getUserRoom } = require('./shared');

const games = new Map();
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

const createLinkedGame = (serverId, user) => ({
  id: crypto.randomUUID(),
  serverId,
  status: 'waiting_link',
  board: Array(9).fill(null),
  turn: 'X',
  winner: null,
  winningLine: [],
  players: [
    { ...getSocketUserSummary(user), symbol: 'X' }
  ]
});

const emitGameUpdate = (io, game) => {
  const payload = getGameView(game);

  game.players.forEach((player) => {
    io.to(getUserRoom(player.id)).emit('private_game_update', payload);
  });
};

const registerGameHandlers = ({ io, socket }) => {
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
          select: { id: true, username: true, fullName: true, avatarUrl: true }
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
          { ...getSocketUserSummary(user), symbol: 'X' },
          { ...getSocketUserSummary(opponent), symbol: 'O' }
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

  socket.on('private_game_link_create', async ({ token, serverId }, callback) => {
    try {
      const user = await getUserFromToken(token);

      if (!user || !serverId) {
        callback?.({ ok: false, error: 'Richiesta non valida' });
        return;
      }

      const requesterMember = await ensureServerMember(serverId, user.id);

      if (!requesterMember) {
        callback?.({ ok: false, error: 'Server non disponibile' });
        return;
      }

      const game = createLinkedGame(serverId, user);
      games.set(game.id, game);
      callback?.({ ok: true, game: getGameView(game) });
    } catch (error) {
      console.error('Errore Socket.IO private_game_link_create:', error);
      callback?.({ ok: false, error: 'Link partita non creato' });
    }
  });

  socket.on('private_game_link_join', async ({ token, gameId }, callback) => {
    try {
      const user = await getUserFromToken(token);
      const game = games.get(gameId);

      if (!user || !game || game.status !== 'waiting_link') {
        callback?.({ ok: false, error: 'Partita non disponibile' });
        return;
      }

      const creator = game.players[0];

      if (creator.id === user.id) {
        callback?.({ ok: true, game: getGameView(game) });
        return;
      }

      const member = await ensureServerMember(game.serverId, user.id);

      if (!member) {
        callback?.({ ok: false, error: 'Non fai parte di questo server' });
        return;
      }

      game.players.push({
        ...getSocketUserSummary(user),
        symbol: 'O'
      });
      game.status = 'active';
      emitGameUpdate(io, game);
      callback?.({ ok: true, game: getGameView(game) });
    } catch (error) {
      console.error('Errore Socket.IO private_game_link_join:', error);
      callback?.({ ok: false, error: 'Ingresso partita non riuscito' });
    }
  });
};

module.exports = registerGameHandlers;
