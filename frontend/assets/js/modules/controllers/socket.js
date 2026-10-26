export const registerSocketController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const joinPendingGameFromUrl = (...args) => app.joinPendingGameFromUrl(...args);
  const renderMessage = (...args) => app.renderMessage(...args);
  const markMessageDeleted = (...args) => app.markMessageDeleted(...args);
  const loadFriends = (...args) => app.loadFriends(...args);
  const resetCall = (...args) => app.resetCall(...args);
  const showCallPanel = (...args) => app.showCallPanel(...args);
  const loadMessages = (...args) => app.loadMessages(...args);
  const createCallPeer = (...args) => app.createCallPeer(...args);
  const handleVideoSignal = (...args) => app.handleVideoSignal(...args);
  const showGame = (...args) => app.showGame(...args);
  const getGameLabel = (...args) => app.getGameLabel(...args);
  const activePrivateUser = (...args) => app.activePrivateUser(...args);
  let refreshAfterServerDisconnect = false;

  // 1. Inizializzazione e connessione WebSocket Socket.IO
  const connectSocket = () => {
    if (state.socket) {
      state.socket.disconnect();
    }
  
    state.socket = io();
  
    // 1.1 Connessione stabilita: autenticazione immediata tramite il token di sessione
    state.socket.on('connect', () => {
      elements.connectionStatus.textContent = 'online';
      elements.connectionStatus.classList.add('online');
  
      // Invio del token al server per associare la socket all'utente
      state.socket.emit('authenticate', { token: state.token }, (response) => {
        if (response?.ok) {
          if (state.activeChannelId) state.socket.emit('join_channel', state.activeChannelId);
          app.loadUnread().catch((error) => showToast(error.message));
          app.loadServerJoinRequests().catch((error) => showToast(error.message));
          joinPendingGameFromUrl();
          if (refreshAfterServerDisconnect) {
            refreshAfterServerDisconnect = false;
            app.loadWorkspaceData().catch((error) => showToast(error.message));
          }
        } else if (refreshAfterServerDisconnect) {
          refreshAfterServerDisconnect = false;
          elements.logoutButton.click();
        }
      });
    });
  
    // 1.2 Gestione disconnessione e fallback stato offline
    state.socket.on('disconnect', (reason) => {
      if (state.call.id) {
        resetCall();
        showToast('Chiamata terminata: connessione al server persa');
        loadMessages().catch(() => {});
      }
      elements.connectionStatus.textContent = 'offline';
      elements.connectionStatus.classList.remove('online');
      state.friendPresence = {};
      app.renderFriends();
      if (reason === 'io server disconnect' && state.token) {
        refreshAfterServerDisconnect = true;
        state.socket.connect();
      }
    });
  
    // 1.3 Ricezione messaggi di canale in tempo reale ('message_created')
    state.socket.on('message_created', (message) => {
      if (message.channelId !== state.activeChannelId) {
        return;
      }
  
      if (elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
        return;
      }
  
      const atBottom = elements.messages.scrollHeight - elements.messages.scrollTop - elements.messages.clientHeight < 96;
      renderMessage(message);
      if (atBottom || message.userId === state.user?.id || message.user?.id === state.user?.id) elements.messages.scrollTop = elements.messages.scrollHeight;
    });

    state.socket.on('channel_message_notification', (message) => {
      app.receiveUnread('channel', message.channelId, message);
    });

    state.socket.on('message_deleted', ({ id, channelId, deletedAt }) => {
      if (channelId === state.activeChannelId) {
        markMessageDeleted({ id, deletedAt });
      }
      app.loadUnread().catch(() => {});
    });

    state.socket.on('channel_updated', (channel) => {
      if (channel?.id && channel?.serverId) app.applyChannelUpdated(channel);
    });
    state.socket.on('channel_deleted', (channel) => {
      if (channel?.id && channel?.serverId) app.applyChannelDeleted(channel).catch((error) => showToast(error.message));
    });

    state.socket.on('private_message_deleted', ({ id, senderId, recipientId, deletedAt }) => {
      app.loadUnread().catch(() => {});
      if (state.activeConversationType !== 'private') return;
      const peerId = state.activePrivateUserId;
      const ownId = state.user?.id;
      if (peerId && ownId && [senderId, recipientId].includes(peerId) &&
          [senderId, recipientId].includes(ownId)) markMessageDeleted({ id, deletedAt });
    });

    // 1.4 Ricezione messaggi privati in tempo reale ('private_message_created')
    state.socket.on('private_message_created', (message) => {
      if (state.user && [message.senderId, message.recipientId].includes(state.user.id)) {
        const peerId = message.senderId === state.user.id ? message.recipientId : message.senderId;
        app.notePrivateConversation(peerId, message.createdAt);
        app.receiveUnread('private', peerId, message);
      }
      const privateUser = activePrivateUser();
      const currentUserId = state.user?.id;

      if (
        state.activeConversationType !== 'private'
        || !privateUser
        || !currentUserId
        || ![message.senderId, message.recipientId].includes(currentUserId)
        || ![message.senderId, message.recipientId].includes(privateUser.id)
      ) {
        return;
      }

      if (elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
        return;
      }

      const atBottom = elements.messages.scrollHeight - elements.messages.scrollTop - elements.messages.clientHeight < 96;
      renderMessage(message);
      if (atBottom || message.senderId === state.user?.id) elements.messages.scrollTop = elements.messages.scrollHeight;
    });

    state.socket.on('friendship_changed', () => {
      loadFriends().catch((error) => showToast(error.message));
    });
    state.socket.on('server_join_requests_changed', () => {
      app.loadServerJoinRequests().catch((error) => showToast(error.message));
    });

    // 1.5 Snapshot e sincronizzazione presenza amici online / offline
    state.socket.on('presence_snapshot', (entries) => {
      state.friendPresence = Object.fromEntries((Array.isArray(entries) ? entries : [])
        .filter((item) => typeof item.userId === 'string').map((item) => [item.userId, Boolean(item.online)]));
      app.renderFriends();
    });
    state.socket.on('presence_changed', ({ userId, online } = {}) => {
      if (!state.friends.some((item) => item.friend.id === userId)) return;
      state.friendPresence[userId] = Boolean(online);
      app.renderFriends();
    });

    // 1.6 Gestione eventi di videochiamata privata WebRTC 1-to-1
    state.socket.on('private_video_call_incoming', (payload) => app.onIncomingCall(payload));

    state.socket.on('private_video_call_answered', (payload) => app.onCallAnswered(payload));
    state.socket.on('private_video_call_claimed', (payload) => app.onCallClaimed(payload));

    state.socket.on('private_video_call_signal', (payload) => {
      handleVideoSignal(payload).catch(() => showToast('Videochiamata non riuscita'));
    });

    state.socket.on('private_video_call_ended', (payload) => app.onCallEnded(payload));

    // 1.7 Gestione inviti e sincronizzazione mosse minigiochi
    state.socket.on('private_game_invite', (game) => {
      showGame(game);
      showToast(`Invito a ${getGameLabel(game.type)} da ${game.players[0].fullName}`);
    });
  
    state.socket.on('private_game_update', (game) => {
      showGame(game);
    });
  };

  Object.assign(app, {
    connectSocket
  });
};
