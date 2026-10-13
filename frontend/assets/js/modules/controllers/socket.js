export const registerSocketController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const joinPendingGameFromUrl = (...args) => app.joinPendingGameFromUrl(...args);
  const renderMessage = (...args) => app.renderMessage(...args);
  const loadFriends = (...args) => app.loadFriends(...args);
  const renderVoiceParticipants = (...args) => app.renderVoiceParticipants(...args);
  const closeVoicePeer = (...args) => app.closeVoicePeer(...args);
  const handleVoiceSignal = (...args) => app.handleVoiceSignal(...args);
  const addVoiceTranscript = (...args) => app.addVoiceTranscript(...args);
  const resetCall = (...args) => app.resetCall(...args);
  const showCallPanel = (...args) => app.showCallPanel(...args);
  const loadMessages = (...args) => app.loadMessages(...args);
  const createCallPeer = (...args) => app.createCallPeer(...args);
  const handleVideoSignal = (...args) => app.handleVideoSignal(...args);
  const showGame = (...args) => app.showGame(...args);
  const getGameLabel = (...args) => app.getGameLabel(...args);
  const activePrivateUser = (...args) => app.activePrivateUser(...args);

  const connectSocket = () => {
    if (state.socket) {
      state.socket.disconnect();
    }
  
    state.socket = io();
  
    state.socket.on('connect', () => {
      elements.connectionStatus.textContent = 'online';
      elements.connectionStatus.classList.add('online');
  
      if (state.activeChannelId) {
        state.socket.emit('join_channel', state.activeChannelId);
      }
  
      state.socket.emit('authenticate', { token: state.token }, (response) => {
        if (response?.ok) {
          joinPendingGameFromUrl();
        }
      });
    });
  
    state.socket.on('disconnect', () => {
      elements.connectionStatus.textContent = 'offline';
      elements.connectionStatus.classList.remove('online');
    });
  
    state.socket.on('message_created', (message) => {
      if (message.channelId !== state.activeChannelId) {
        return;
      }
  
      if (elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
        return;
      }
  
      renderMessage(message);
      elements.messages.scrollTop = elements.messages.scrollHeight;
    });

    state.socket.on('private_message_created', (message) => {
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

      renderMessage(message);
      elements.messages.scrollTop = elements.messages.scrollHeight;
    });

    state.socket.on('friendship_changed', () => {
      loadFriends().catch((error) => showToast(error.message));
    });

    state.socket.on('voice_participants', ({ channelId, participants }) => {
      if (channelId !== state.voice.channelId) {
        return;
      }

      state.voice.participants = participants || [];
      renderVoiceParticipants();
    });

    state.socket.on('voice_peer_joined', () => {
      renderVoiceParticipants();
    });

    state.socket.on('voice_peer_left', ({ socketId }) => {
      closeVoicePeer(socketId);
    });

    state.socket.on('voice_signal', (payload) => {
      handleVoiceSignal(payload).catch(() => showToast('Segnale vocale non valido'));
    });

    state.socket.on('voice_transcript', (entry) => {
      if (entry.channelId !== state.voice.channelId) {
        return;
      }

      addVoiceTranscript(entry);
    });

    state.socket.on('private_video_call_incoming', ({ callId, from }) => {
      resetCall();
      state.call.id = callId;
      state.call.friend = from;
      state.call.incoming = true;
      showCallPanel(`Chiamata in arrivo da ${from.fullName}`);
    });

    state.socket.on('private_video_call_answered', async ({ callId, accepted, from }) => {
      if (callId !== state.call.id) {
        return;
      }

      if (!accepted) {
        showToast('Chiamata rifiutata');
        resetCall();
        await loadMessages();
        return;
      }

      state.call.friend = from;
      createCallPeer(from.id);
      showCallPanel('Connessione in corso...');
    });

    state.socket.on('private_video_call_signal', (payload) => {
      handleVideoSignal(payload).catch(() => showToast('Videochiamata non riuscita'));
    });

    state.socket.on('private_video_call_ended', ({ callId }) => {
      if (callId !== state.call.id) {
        return;
      }

      showToast('Chiamata terminata');
      resetCall();
      loadMessages();
    });

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
