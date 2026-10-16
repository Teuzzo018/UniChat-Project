export const registerNavigationController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeChannel = (...args) => app.activeChannel(...args);
  const activePrivateUser = (...args) => app.activePrivateUser(...args);
  const activeServer = (...args) => app.activeServer(...args);
  const renderVoicePanel = (...args) => app.renderVoicePanel(...args);
  const resetCall = (...args) => app.resetCall(...args);
  const leaveVoiceChannel = (...args) => app.leaveVoiceChannel(...args);
  const renderChannels = (...args) => app.renderChannels(...args);
  const renderServers = (...args) => app.renderServers(...args);
  const loadAvailableServers = (...args) => app.loadAvailableServers(...args);
  const renderMessage = (...args) => app.renderMessage(...args);
  const setDefaultEmptyState = (...args) => app.setDefaultEmptyState(...args);
  let messageLoadSequence = 0;

  const loadMessages = async () => {
    const currentLoad = ++messageLoadSequence;
    const channel = activeChannel();
    const privateUser = activePrivateUser();

    elements.adminPanel.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.callPanel.classList.add('hidden');
    elements.voicePanel.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    document.querySelector('#homePanel').classList.add('hidden');
    app.releaseAttachments();
    elements.messages.replaceChildren();
    const hasConversation = state.activeConversationType === 'private' ? Boolean(privateUser) : Boolean(channel);
    const emptyServer = Boolean(state.activeServerId && state.activeConversationType === 'channel' && !channel);
    elements.emptyState.classList.toggle('hidden', hasConversation || (Boolean(state.user) && !emptyServer));
    document.querySelector('#homePanel').classList.toggle('hidden', hasConversation || !state.user || emptyServer);
    elements.messages.classList.toggle('hidden', !hasConversation || channel?.type === 'VOICE');
    elements.messageForm.classList.toggle('hidden', !hasConversation || channel?.type === 'VOICE');

    if (!hasConversation) {
      setDefaultEmptyState();
      if (emptyServer) {
        elements.emptyState.querySelector('h2').textContent = 'Nessun canale';
        elements.emptyState.querySelector('p').textContent = 'Un gestore del server può creare un canale dalla barra laterale.';
      }
      elements.channelTitle.textContent = emptyServer ? activeServer()?.name || 'Server' : state.user ? 'Home' : 'Benvenuto in UniChat';
      elements.channelType.textContent = emptyServer ? 'Server' : state.user ? 'Panoramica' : 'Canale';
      elements.videoCallButton.classList.add('hidden');
      document.querySelector('#audioCallButton').classList.add('hidden');
      return;
    }

    if (state.activeConversationType === 'private') {
      elements.channelTitle.textContent = privateUser.fullName;
      elements.channelType.textContent = `Privato ${getDisplayHandle(privateUser)}`;
      elements.videoCallButton.classList.remove('hidden');
      document.querySelector('#audioCallButton').classList.remove('hidden');
      const loading = document.createElement('p');
      loading.className = 'message-loading';
      loading.textContent = 'Caricamento messaggi…';
      loading.setAttribute('role', 'status');
      elements.messages.append(loading);
      try {
        const messages = await api(`/private/${privateUser.id}/messages`);
        if (currentLoad !== messageLoadSequence) return;
        elements.messages.replaceChildren();
        messages.forEach(renderMessage);
        elements.messages.scrollTop = elements.messages.scrollHeight;
      } catch (error) {
        if (currentLoad === messageLoadSequence) loading.textContent = `Impossibile caricare i messaggi: ${error.message}`;
      }
      return;
    }

    elements.channelTitle.textContent = channel.name;
    elements.channelType.textContent = channel.type === 'TEXT' ? 'Canale testuale' : 'Canale vocale';
    elements.videoCallButton.classList.add('hidden');
    document.querySelector('#audioCallButton').classList.add('hidden');

    if (channel.type !== 'TEXT') {
      renderVoicePanel();
      return;
    }
  
    const loading = document.createElement('p');
    loading.className = 'message-loading';
    loading.textContent = 'Caricamento messaggi…';
    loading.setAttribute('role', 'status');
    elements.messages.append(loading);
    try {
      const messages = await api(`/channels/${channel.id}/messages`);
      if (currentLoad !== messageLoadSequence) return;
      elements.messages.replaceChildren();
      messages.forEach(renderMessage);
      elements.messages.scrollTop = elements.messages.scrollHeight;
    } catch (error) {
      if (currentLoad === messageLoadSequence) loading.textContent = `Impossibile caricare i messaggi: ${error.message}`;
    }
  };

  const selectChannel = async (channelId) => {
    resetCall({ notifyPeer: true });
    if (state.voice.channelId && state.voice.channelId !== channelId) {
      await leaveVoiceChannel();
    }
    state.activeChannelId = channelId;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.socket?.emit('join_channel', channelId);
    renderChannels();
    await loadMessages();
    app.closeMobileNav?.();
  };

  const selectPrivateChat = async (user) => {
    if (!state.friends.some((friendship) => friendship.friend.id === user?.id)) {
      showToast('Puoi scrivere solo agli amici');
      return;
    }
    await leaveVoiceChannel();
    resetCall({ notifyPeer: true });
    state.activePrivateUserId = user.id;
    state.activeServerId = null;
    state.activeChannelId = null;
    state.activeConversationType = 'private';
    state.activeOverviewPanel = 'directMessages';
    state.game = null;
    renderServers();
    renderChannels();
    await loadMessages();
    app.closeMobileNav?.();
  };

  const selectServer = async (serverId) => {
    await leaveVoiceChannel();
    resetCall({ notifyPeer: true });
    state.activeServerId = serverId;
    state.activeOverviewPanel = 'channels';
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.game = null;
    const server = activeServer();
    state.activeChannelId = server?.channels.find((channel) => channel.type === 'TEXT')?.id || server?.channels[0]?.id || null;
    renderServers();
    renderChannels();
  
    if (state.activeChannelId) {
      state.socket?.emit('join_channel', state.activeChannelId);
    }
  
    await loadMessages();
    app.closeMobileNav?.();
  };

  Object.assign(app, {
    loadMessages,
    selectChannel,
    selectPrivateChat,
    selectServer
  });
};
