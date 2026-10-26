/**
 * ============================================================================
 * CONTROLLER SCACCHIERA MINIGIOCHI (gameBoard.js)
 * 1. Rendering scacchiera: visualizzazione grafica griglia Tris o parola Impiccato
 * 2. Invio mossa: validazione client ed emissione mossa verso il server via Socket.IO
 * 3. Schermata finale: visualizzazione esito (vittoria, pareggio, sconfitta) e rivincita
 * ============================================================================
 */
export const registerGameBoardController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const renderChannels = (...args) => app.renderChannels(...args);
  const loadMessages = (...args) => app.loadMessages(...args);
  const playGameMove = (...args) => app.playGameMove(...args);

  const getCurrentPlayer = () => {
    return state.game?.players.find((player) => player.id === state.user.id);
  };

  const getOpponent = () => {
    return state.game?.players.find((player) => player.id !== state.user.id);
  };

  const getGameLabel = (type = state.game?.type) => {
    return type === 'HANGMAN' ? 'Impiccato' : 'Tris';
  };

  const setGameStatus = () => {
    if (!state.game) {
      elements.gameStatus.textContent = 'Scegli un utente dal server.';
      return;
    }
  
    const player = getCurrentPlayer();
    const opponent = getOpponent();

    elements.gameTitle.textContent = `${getGameLabel()} con ${opponent?.fullName || 'utente'}`;

    if (state.game.status === 'pending') {
      const invited = state.game.players[1]?.id === state.user.id;
      elements.gameStatus.textContent = invited ? 'Invito ricevuto.' : 'Invito inviato.';
      return;
    }
  
    if (state.game.status === 'declined') {
      elements.gameStatus.textContent = 'Invito rifiutato.';
      return;
    }

    if (state.game.status === 'waiting_link') {
      elements.gameStatus.textContent = 'Link inviato. In attesa che qualcuno entri.';
      return;
    }

    if (state.game.winner === 'draw') {
      elements.gameStatus.textContent = 'Pareggio.';
      return;
    }

    if (state.game.type === 'HANGMAN' && state.game.winner) {
      elements.gameStatus.textContent = state.game.winner === 'players'
        ? 'Parola completata. Avete vinto.'
        : 'Tentativi finiti. Avete perso.';
      return;
    }

    if (state.game.winner) {
      elements.gameStatus.textContent = state.game.winner === player?.symbol ? 'Hai vinto.' : 'Hai perso.';
      return;
    }

    elements.gameStatus.textContent = state.game.turn === player?.symbol ? 'Tocca a te.' : `Turno di ${opponent?.fullName || 'avversario'}.`;
  };

  const renderTicTacToeGame = (player) => {
    const canMove = state.game?.status === 'active' && state.game.turn === player?.symbol && !state.game.winner;

    elements.gameBoard.className = 'game-board';

    for (let index = 0; index < 9; index += 1) {
      const cell = document.createElement('button');
      cell.className = `game-cell ${state.game?.winningLine.includes(index) ? 'win' : ''}`;
      cell.type = 'button';
      cell.textContent = state.game?.board[index] || '';
      cell.disabled = !canMove || Boolean(state.game?.board[index]);
      cell.addEventListener('click', () => playGameMove(index));
      elements.gameBoard.append(cell);
    }
  };

  const renderHangmanGame = (player) => {
    const canMove = state.game?.status === 'active' && state.game.turn === player?.symbol && !state.game.winner;
    const usedLetters = new Set([
      ...(state.game?.guessedLetters || []),
      ...(state.game?.wrongLetters || [])
    ]);

    elements.gameBoard.className = 'game-board hangman-board';

    const word = document.createElement('div');
    word.className = 'hangman-word';
    word.textContent = (state.game?.maskedWord || []).join(' ');

    const attempts = document.createElement('div');
    attempts.className = 'hangman-attempts';
    attempts.textContent = `Errori: ${(state.game?.wrongLetters || []).length}/${state.game?.maxAttempts || 6}`;

    const wrong = document.createElement('div');
    wrong.className = 'hangman-wrong';
    wrong.textContent = `Lettere sbagliate: ${(state.game?.wrongLetters || []).join(', ') || '-'}`;

    const keyboard = document.createElement('div');
    keyboard.className = 'hangman-keyboard';

    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((letter) => {
      const button = document.createElement('button');
      button.className = 'hangman-key';
      button.type = 'button';
      button.textContent = letter;
      button.disabled = !canMove || usedLetters.has(letter);
      button.addEventListener('click', () => playGameMove(letter));
      keyboard.append(button);
    });

    elements.gameBoard.append(word, attempts, wrong, keyboard);
  };

  const renderGame = () => {
    elements.emptyState.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    elements.superAdminPanel.classList.add('hidden');
    elements.callPanel.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.gamePanel.classList.remove('hidden');
    document.querySelector('#homePanel').classList.add('hidden');
    elements.gameBoard.replaceChildren();

    const player = getCurrentPlayer();
    const invited = state.game?.status === 'pending' && state.game.players[1]?.id === state.user.id;

    elements.acceptGameButton.classList.toggle('hidden', !invited);
    elements.declineGameButton.classList.toggle('hidden', !invited);
    elements.restartGameButton.classList.toggle('hidden', state.game?.status !== 'finished');

    if (state.game?.type === 'HANGMAN') {
      renderHangmanGame(player);
    } else {
      renderTicTacToeGame(player);
    }

    setGameStatus();
  };

  const showGame = (game) => {
    state.game = game;
    state.activePrivateUserId = getOpponent()?.id || state.activePrivateUserId;
    state.activeChannelId = null;
    renderChannels();
    renderGame();
  };

  const closeGame = () => {
    const opponentId = getOpponent()?.id || state.activePrivateUserId;
    state.game = null;
    state.activePrivateUserId = state.friends.some((item) => item.friend.id === opponentId) ? opponentId : null;
    state.activeServerId = null;
    state.activeConversationType = 'private';
    elements.gamePanel.classList.add('hidden');
    renderChannels();
    loadMessages();
  };

  Object.assign(app, {
    getCurrentPlayer,
    getOpponent,
    getGameLabel,
    setGameStatus,
    renderTicTacToeGame,
    renderHangmanGame,
    renderGame,
    showGame,
    closeGame
  });
};
