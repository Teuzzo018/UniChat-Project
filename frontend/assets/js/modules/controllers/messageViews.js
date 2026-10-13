export const registerMessageViewsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const resetCall = (...args) => app.resetCall(...args);
  const renderChannels = (...args) => app.renderChannels(...args);
  const renderAttachment = (...args) => app.renderAttachment(...args);

  const renderMessage = (message) => {
    const article = document.createElement('article');
    const authorUser = message.user || message.sender;
    const ownMessage = authorUser.id === state.user?.id;
    article.className = `message ${ownMessage ? 'own' : 'other'}`;
    article.dataset.messageId = message.id;

    const avatar = createUserAvatar(authorUser);
  
    const body = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'message-meta';
  
    const author = document.createElement('span');
    author.className = 'message-author';
    author.textContent = authorUser.fullName;
  
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(message.createdAt));
  
    const content = document.createElement('p');
    content.className = 'message-content';
    appendMessageContent(content, message.content || '');

    meta.append(author, time);
    body.append(meta);
    if (message.content) {
      body.append(content);
    }
    const attachment = renderAttachment(message);
    if (attachment) {
      body.append(attachment);
    }
    article.append(avatar, body);
    elements.messages.append(article);
  };

  const getCallStatusText = (call) => {
    const ownCall = call.callerId === state.user?.id;

    if (call.status === 'DECLINED') {
      return ownCall ? 'Rifiutata' : 'Rifiutata da te';
    }

    if (call.status === 'RINGING') {
      return ownCall ? 'In uscita' : 'In arrivo';
    }

    if (call.status === 'ACCEPTED') {
      return 'Accettata';
    }

    return ownCall ? 'Effettuata' : 'Ricevuta';
  };

  const renderCallHistory = (calls) => {
    elements.callHistoryList.replaceChildren();

    if (!calls.length) {
      const empty = document.createElement('p');
      empty.className = 'call-history-empty';
      empty.textContent = 'Nessuna chiamata ancora.';
      elements.callHistoryList.append(empty);
      return;
    }

    calls.forEach((call) => {
      const row = document.createElement('article');
      row.className = 'call-history-item';

      const icon = document.createElement('div');
      icon.className = 'call-history-icon';
      icon.textContent = call.status === 'DECLINED' ? '!' : '↗';

      const copy = document.createElement('div');

      const title = document.createElement('strong');
      title.textContent = getCallStatusText(call);

      const detail = document.createElement('span');
      const startedAt = new Date(call.startedAt);
      detail.textContent = startedAt.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      copy.append(title, detail);
      row.append(icon, copy);
      elements.callHistoryList.append(row);
    });
  };

  const loadCallHistory = async (userId) => {
    const calls = await api(`/private/${userId}/calls`);
    renderCallHistory(calls);
  };

  const showCallHistoryForUser = async (user) => {
    resetCall();
    state.activePrivateUserId = user.id;
    state.activeChannelId = null;
    state.activeConversationType = 'private';
    state.game = null;
    renderChannels();

    elements.emptyState.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.voicePanel.classList.add('hidden');
    elements.callPanel.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.callHistory.classList.remove('hidden');
    elements.videoCallButton.classList.remove('hidden');
    elements.channelTitle.textContent = `Chiamate con ${user.fullName}`;
    elements.channelType.textContent = `Storico ${getDisplayHandle(user)}`;

    try {
      await loadCallHistory(user.id);
    } catch (error) {
      showToast(error.message);
    }
  };

  Object.assign(app, {
    renderMessage,
    getCallStatusText,
    renderCallHistory,
    loadCallHistory,
    showCallHistoryForUser
  });
};
