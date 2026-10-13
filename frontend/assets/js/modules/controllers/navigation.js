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

  const loadMessages = async () => {
    const channel = activeChannel();
    const privateUser = activePrivateUser();

    elements.adminPanel.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.callPanel.classList.add('hidden');
    elements.voicePanel.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    elements.messages.replaceChildren();
    const hasConversation = state.activeConversationType === 'private' ? Boolean(privateUser) : Boolean(channel);
    elements.emptyState.classList.toggle('hidden', hasConversation);
    elements.messages.classList.toggle('hidden', !hasConversation || channel?.type === 'VOICE');
    elements.messageForm.classList.toggle('hidden', !hasConversation || channel?.type === 'VOICE');

    if (!hasConversation) {
      setDefaultEmptyState();
      elements.channelTitle.textContent = state.user ? 'Home' : 'Benvenuto in UniChat';
      elements.channelType.textContent = state.user ? 'Panoramica' : 'Canale';
      elements.videoCallButton.classList.add('hidden');
      return;
    }

    if (state.activeConversationType === 'private') {
      elements.channelTitle.textContent = privateUser.fullName;
      elements.channelType.textContent = `Privato ${getDisplayHandle(privateUser)}`;
      elements.videoCallButton.classList.remove('hidden');
      const messages = await api(`/private/${privateUser.id}/messages`);
      messages.forEach(renderMessage);
      elements.messages.scrollTop = elements.messages.scrollHeight;
      return;
    }

    elements.channelTitle.textContent = channel.name;
    elements.channelType.textContent = channel.type === 'TEXT' ? 'Canale testuale' : 'Canale vocale';
    elements.videoCallButton.classList.add('hidden');

    if (channel.type !== 'TEXT') {
      renderVoicePanel();
      return;
    }
  
    const messages = await api(`/channels/${channel.id}/messages`);
    messages.forEach(renderMessage);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  };

  const selectChannel = async (channelId) => {
    resetCall();
    if (state.voice.channelId && state.voice.channelId !== channelId) {
      await leaveVoiceChannel();
    }
    state.activeChannelId = channelId;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.socket?.emit('join_channel', channelId);
    renderChannels();
    await loadMessages();
  };

  const selectPrivateChat = async (user) => {
    await leaveVoiceChannel();
    resetCall();
    state.activePrivateUserId = user.id;
    state.activeChannelId = null;
    state.activeConversationType = 'private';
    state.game = null;
    renderChannels();
    await loadMessages();
  };

  const selectServer = async (serverId) => {
    await leaveVoiceChannel();
    resetCall();
    state.activeServerId = serverId;
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
  };

  Object.assign(app, {
    loadMessages,
    selectChannel,
    selectPrivateChat,
    selectServer
  });
};
