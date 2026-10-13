export const registerGameLauncherController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeServer = (...args) => app.activeServer(...args);
  const activePrivateUser = (...args) => app.activePrivateUser(...args);
  const showGame = (...args) => app.showGame(...args);
  const getGameLabel = (...args) => app.getGameLabel(...args);

  const startPrivateGame = (opponentId, type = state.selectedGameType) => {
    const server = activeServer();

    if (!state.socket?.connected) {
      showToast('Connessione non disponibile');
      return;
    }
  
    state.activePrivateUserId = opponentId;
    state.socket.emit('private_game_request', {
      token: state.token,
      opponentId,
      serverId: server?.id || null,
      type
    }, (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Partita non avviata');
        return;
      }
  
      showGame(response.game);
    });
  };

  const getPlayableMembers = () => {
    return state.friends.map((friendship) => friendship.friend);
  };

  const renderGameLauncher = () => {
    elements.gameFriendList.replaceChildren();
    elements.gameTypeButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.gameType === state.selectedGameType);
    });

    const members = getPlayableMembers();
    elements.sendGameLinkButton.disabled = !activeServer() || (!state.activeChannelId && state.activeConversationType !== 'private');

    if (members.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'game-launcher-empty';
      empty.textContent = 'Nessun amico disponibile.';
      elements.gameFriendList.append(empty);
      return;
    }

    members.forEach((member) => {
      const button = document.createElement('button');
      button.className = 'game-launcher-user';
      button.type = 'button';

      const name = document.createElement('span');
      name.textContent = member.fullName;

      button.append(createUserAvatar(member, 'member-avatar'), name);
      button.addEventListener('click', () => {
        elements.gameDialog.close();
        startPrivateGame(member.id, state.selectedGameType);
      });
      elements.gameFriendList.append(button);
    });
  };

  const openGameDialog = () => {
    if (!state.user) {
      showToast('Accedi per giocare');
      return;
    }

    renderGameLauncher();
    elements.gameDialog.showModal();
  };

  const postTextToActiveConversation = async (content) => {
    if (state.activeConversationType === 'private') {
      const privateUser = activePrivateUser();

      if (!privateUser) {
        throw new Error('Apri una chat privata');
      }

      const formData = new FormData();
      formData.append('content', content);
      await api(`/private/${privateUser.id}/messages`, {
        method: 'POST',
        body: formData
      });
      return;
    }

    if (!state.activeChannelId) {
      throw new Error('Apri un canale testuale');
    }

    await new Promise((resolve, reject) => {
      state.socket.emit('send_message', {
        token: state.token,
        channelId: state.activeChannelId,
        content
      }, (response) => {
        if (!response?.ok) {
          reject(new Error(response?.error || 'Messaggio non inviato'));
          return;
        }
        resolve(response.message);
      });
    });
  };

  const sendGameLinkToChat = () => {
    const server = activeServer();

    if (!server || !state.socket?.connected) {
      showToast('Connessione non disponibile');
      return;
    }

    state.socket.emit('private_game_link_create', {
      token: state.token,
      serverId: server.id,
      type: state.selectedGameType
    }, async (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Link non creato');
        return;
      }

      const gameUrl = `${window.location.origin}${window.location.pathname}?game=${response.game.id}`;
      const gameLabel = getGameLabel(response.game.type);

      try {
        await postTextToActiveConversation(`Invito a ${gameLabel}: ${gameUrl}`);
        elements.gameDialog.close();
        showGame(response.game);
        showToast(`Link ${gameLabel} inviato`);
      } catch (error) {
        showToast(error.message);
      }
    });
  };

  const clearGameFromUrl = () => {
    if (!new URLSearchParams(window.location.search).has('game')) {
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const joinPendingGameFromUrl = () => {
    if (!state.pendingGameId || !state.socket?.connected) {
      return;
    }

    state.socket.emit('private_game_link_join', {
      token: state.token,
      gameId: state.pendingGameId
    }, (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Invito gioco non disponibile');
        return;
      }

      state.pendingGameId = null;
      clearGameFromUrl();
      showGame(response.game);
    });
  };

  const answerGameInvite = (accepted) => {
    if (!state.game) {
      return;
    }
  
    state.socket.emit('private_game_accept', {
      token: state.token,
      gameId: state.game.id,
      accepted
    }, (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Risposta non inviata');
        return;
      }
  
      showGame(response.game);
    });
  };

  const playGameMove = (index) => {
    if (!state.game) {
      return;
    }
  
    state.socket.emit('private_game_move', {
      token: state.token,
      gameId: state.game.id,
      index
    }, (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Mossa non valida');
      }
    });
  };

  const restartGame = () => {
    if (!state.game) {
      return;
    }
  
    state.socket.emit('private_game_restart', {
      token: state.token,
      gameId: state.game.id
    }, (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Partita non riavviata');
      }
    });
  };

  Object.assign(app, {
    startPrivateGame,
    getPlayableMembers,
    renderGameLauncher,
    openGameDialog,
    postTextToActiveConversation,
    sendGameLinkToChat,
    clearGameFromUrl,
    joinPendingGameFromUrl,
    answerGameInvite,
    playGameMove,
    restartGame
  });
};
