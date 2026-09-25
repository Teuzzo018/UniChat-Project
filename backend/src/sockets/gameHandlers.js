const crypto = require('crypto');

const prisma = require('../lib/prisma');
const { ensureServerMember } = require('../controllers/serverControllers');
const { getSocketUserSummary, getUserFromToken, getUserRoom } = require('./shared');

const games = new Map();
const gameTypes = {
  TICTACTOE: 'TICTACTOE',
  HANGMAN: 'HANGMAN'
};
const hangmanWords = [
  'UNIVERSITA',
  'ESAME',
  'BIBLIOTECA',
  'LABORATORIO',
  'SESSIONE',
  'PROGETTO',
  'LEZIONE',
  'APPUNTI',
  'MATRICOLA',
  'DIPARTIMENTO',
  'RICERCA',
  'SEMINARIO'
];
const maxHangmanAttempts = 6;
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

const getGameType = (type) => {
  return Object.values(gameTypes).includes(type) ? type : gameTypes.TICTACTOE;
};

const createHangmanState = () => ({
  secretWord: hangmanWords[Math.floor(Math.random() * hangmanWords.length)],
  guessedLetters: [],
  wrongLetters: [],
  maxAttempts: maxHangmanAttempts
});

const getMaskedWord = (game) => {
  if (game.type !== gameTypes.HANGMAN || !game.secretWord) {
    return [];
  }

  return game.secretWord.split('').map((letter) => {
    return game.guessedLetters.includes(letter) ? letter : '_';
  });
};

const isHangmanSolved = (game) => getMaskedWord(game).every((letter) => letter !== '_');

const getGameView = (game) => ({
  id: game.id,
  type: game.type,
  status: game.status,
  board: game.board,
  turn: game.turn,
  winner: game.winner,
  winningLine: game.winningLine,
  players: game.players,
  serverId: game.serverId,
  maskedWord: getMaskedWord(game),
  guessedLetters: game.guessedLetters || [],
  wrongLetters: game.wrongLetters || [],
  remainingAttempts: game.type === gameTypes.HANGMAN
    ? game.maxAttempts - (game.wrongLetters?.length || 0)
    : null,
  maxAttempts: game.type === gameTypes.HANGMAN ? game.maxAttempts : null
});

const createGame = ({ serverId = null, status, type, firstUser, secondUser = null }) => {
  const gameType = getGameType(type);
  const hangmanState = gameType === gameTypes.HANGMAN ? createHangmanState() : {};

  return {
    id: crypto.randomUUID(),
    type: gameType,
    serverId,
    status,
    board: gameType === gameTypes.TICTACTOE ? Array(9).fill(null) : [],
    turn: 'X',
    winner: null,
    winningLine: [],
    players: [
      { ...getSocketUserSummary(firstUser), symbol: 'X' },
      ...(secondUser ? [{ ...getSocketUserSummary(secondUser), symbol: 'O' }] : [])
    ],
    ...hangmanState
  };
};

const ensureAcceptedFriendship = async (firstUserId, secondUserId) => {
  const [requesterId, addresseeId] = [firstUserId, secondUserId].sort();

  return prisma.friendship.findFirst({
    where: {
      requesterId,
      addresseeId,
      status: 'ACCEPTED'
    },
    select: { id: true }
  });
};

const emitGameUpdate = (io, game) => {
  const payload = getGameView(game);

  game.players.forEach((player) => {
    io.to(getUserRoom(player.id)).emit('private_game_update', payload);
  });
};

const resetGame = (game) => {
  game.status = 'active';
  game.turn = 'X';
  game.winner = null;
  game.winningLine = [];

  if (game.type === gameTypes.HANGMAN) {
    const hangmanState = createHangmanState();
    game.secretWord = hangmanState.secretWord;
    game.guessedLetters = hangmanState.guessedLetters;
    game.wrongLetters = hangmanState.wrongLetters;
    game.maxAttempts = hangmanState.maxAttempts;
    game.board = [];
    return;
  }

  game.board = Array(9).fill(null);
};

const registerGameHandlers = ({ io, socket }) => {
  socket.on('private_game_request', async ({ token, opponentId, serverId, type }, callback) => {
    try {
      const user = await getUserFromToken(token);

      if (!user || !opponentId || opponentId === user.id) {
        callback?.({ ok: false, error: 'Richiesta non valida' });
        return;
      }

      const [friendship, opponent] = await Promise.all([
        ensureAcceptedFriendship(user.id, opponentId),
        prisma.user.findUnique({
          where: { id: opponentId },
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        })
      ]);

      if (!friendship || !opponent) {
        callback?.({ ok: false, error: 'Puoi invitare solo un amico' });
        return;
      }

      if (serverId) {
        const [requesterMember, opponentMember] = await Promise.all([
          ensureServerMember(serverId, user.id),
          ensureServerMember(serverId, opponentId)
        ]);

        if (!requesterMember || !opponentMember) {
          callback?.({ ok: false, error: 'Utente non disponibile in questo server' });
          return;
        }
      }

      const game = createGame({
        serverId: serverId || null,
        status: 'pending',
        type,
        firstUser: user,
        secondUser: opponent
      });

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

      if (player.symbol !== game.turn) {
        callback?.({ ok: false, error: 'Non e il tuo turno' });
        return;
      }

      if (game.type === gameTypes.HANGMAN) {
        const letter = typeof index === 'string' ? index.trim().toUpperCase() : '';

        if (!/^[A-Z]$/.test(letter)) {
          callback?.({ ok: false, error: 'Lettera non valida' });
          return;
        }

        if (game.guessedLetters.includes(letter) || game.wrongLetters.includes(letter)) {
          callback?.({ ok: false, error: 'Lettera gia usata' });
          return;
        }

        if (game.secretWord.includes(letter)) {
          game.guessedLetters.push(letter);
        } else {
          game.wrongLetters.push(letter);
        }

        if (isHangmanSolved(game)) {
          game.winner = 'players';
          game.status = 'finished';
        } else if (game.wrongLetters.length >= game.maxAttempts) {
          game.winner = 'hangman';
          game.status = 'finished';
        } else {
          game.turn = game.turn === 'X' ? 'O' : 'X';
        }

        emitGameUpdate(io, game);
        callback?.({ ok: true, game: getGameView(game) });
        return;
      }

      if (!Number.isInteger(index) || index < 0 || index > 8 || game.board[index]) {
        callback?.({ ok: false, error: 'Mossa non valida' });
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

      resetGame(game);

      emitGameUpdate(io, game);
      callback?.({ ok: true, game: getGameView(game) });
    } catch (error) {
      console.error('Errore Socket.IO private_game_restart:', error);
      callback?.({ ok: false, error: 'Riavvio partita non riuscito' });
    }
  });

  socket.on('private_game_link_create', async ({ token, serverId, type }, callback) => {
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

      const game = createGame({
        serverId,
        status: 'waiting_link',
        type,
        firstUser: user
      });
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
