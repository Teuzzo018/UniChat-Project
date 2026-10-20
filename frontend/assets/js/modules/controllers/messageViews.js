export const registerMessageViewsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const resetCall = (...args) => app.resetCall(...args);
  const renderChannels = (...args) => app.renderChannels(...args);
  const renderServers = (...args) => app.renderServers(...args);
  const renderAttachment = (...args) => app.renderAttachment(...args);
  const favoritesDialog = document.querySelector('#favoritesDialog');
  const favoritesList = document.querySelector('#favoritesList');
  const favoritesStatus = document.querySelector('#favoritesStatus');

  const favoriteKey = (kind, id) => `${kind}:${id}`;
  const isFavorite = (kind, id) => state.favorites.some((item) => favoriteKey(item.kind, item.id) === favoriteKey(kind, id));

  const renderFavorites = () => {
    favoritesList.replaceChildren();
    favoritesStatus.textContent = state.favorites.length ? '' : 'Nessun messaggio preferito.';
    for (const item of state.favorites) {
      const row = document.createElement('article');
      row.className = 'favorite-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.location;
      const author = document.createElement('span');
      author.textContent = item.author;
      const content = document.createElement('p');
      content.textContent = item.content || 'Allegato';
      info.append(title, author, content);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost-button';
      remove.textContent = 'Rimuovi';
      remove.setAttribute('aria-label', `Rimuovi dai preferiti il messaggio di ${item.author}`);
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          await api(`/favorites/${item.kind}/${item.id}`, { method: 'DELETE' });
          state.favorites = state.favorites.filter((entry) => favoriteKey(entry.kind, entry.id) !== favoriteKey(item.kind, item.id));
          renderFavorites();
          updateFavoriteButtons();
        } catch (error) { remove.disabled = false; showToast(error.message); }
      });
      row.append(info, remove);
      favoritesList.append(row);
    }
  };

  const updateFavoriteButtons = () => {
    elements.messages.querySelectorAll('.message-actions').forEach((menu) => {
      const button = menu.querySelector('.message-favorite-button');
      if (!button) return;
      const saved = isFavorite(menu.dataset.kind, menu.dataset.messageId);
      button.textContent = saved ? 'Rimuovi dai preferiti' : 'Metti nei preferiti';
      button.setAttribute('aria-pressed', String(saved));
      menu.closest('.message')?.classList.toggle('favorite', saved);
    });
  };

  const loadFavorites = async () => {
    state.favorites = await api('/favorites');
    renderFavorites();
    updateFavoriteButtons();
  };
  document.querySelector('#openFavoritesButton').addEventListener('click', async () => {
    favoritesDialog.showModal();
    favoritesStatus.textContent = 'Caricamento preferiti…';
    try { await loadFavorites(); } catch (error) { favoritesStatus.textContent = error.message; }
  });
  document.querySelector('#closeFavoritesDialog').addEventListener('click', () => favoritesDialog.close());

  const renderMessage = (message) => {
    const article = document.createElement('article');
    const authorUser = message.user || message.sender;
    const ownMessage = authorUser.id === state.user?.id;
    article.className = `message ${ownMessage ? 'own' : 'other'}`;
    article.dataset.messageId = message.id;
    if (message.deletedAt) article.dataset.deletedAt = message.deletedAt;

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
    if (message.deletedAt) content.textContent = 'Messaggio eliminato';
    else appendMessageContent(content, message.content || '');

    meta.append(author, time);
    body.append(meta);
    if (message.content || message.deletedAt) {
      body.append(content);
    }
    const attachment = message.deletedAt ? null : renderAttachment(message);
    if (attachment) {
      body.append(attachment);
    }
    if (!message.deletedAt) {
      const kind = message.channelId ? 'channel' : 'private';
      const server = state.servers.find((item) => item.channels.some((channel) => channel.id === message.channelId));
      const localAdmin = message.channelId && server && (server.ownerId === state.user?.id
        || server.members.some((membership) => membership.user.id === state.user?.id && membership.isAdmin));
      const canDeleteChannel = message.channelId && (ownMessage || localAdmin);
      const canDeletePrivate = !message.channelId && ownMessage && message.senderId === state.user?.id;
      const actions = document.createElement('details');
      actions.className = 'message-actions';
      actions.dataset.kind = kind;
      actions.dataset.messageId = message.id;
      const summary = document.createElement('summary');
      summary.setAttribute('aria-label', `Azioni per il messaggio di ${authorUser.fullName}`);
      summary.textContent = '⋯';
      const menu = document.createElement('div');
      menu.className = 'message-actions-menu';
      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.className = 'message-favorite-button';
      favorite.textContent = isFavorite(kind, message.id) ? 'Rimuovi dai preferiti' : 'Metti nei preferiti';
      favorite.setAttribute('aria-pressed', String(isFavorite(kind, message.id)));
      favorite.addEventListener('click', async () => {
        const saved = isFavorite(kind, message.id);
        favorite.disabled = true;
        try {
          await api(`/favorites/${kind}/${message.id}`, { method: saved ? 'DELETE' : 'PUT' });
          await loadFavorites();
          actions.open = false;
          showToast(saved ? 'Rimosso dai preferiti' : 'Messaggio nei preferiti');
        } catch (error) { showToast(error.message); }
        finally { favorite.disabled = false; }
      });
      menu.append(favorite);
      if (canDeleteChannel || canDeletePrivate) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'message-delete-button';
        remove.textContent = 'Elimina per tutti';
        remove.addEventListener('click', async () => {
          if (!await showConfirm('Eliminare questo messaggio per tutti?', 'Elimina')) return;
          remove.disabled = true;
          try {
            const path = message.channelId
              ? `/channels/${message.channelId}/messages/${message.id}`
              : `/private/${message.recipientId}/messages/${message.id}`;
            const result = await api(path, { method: 'DELETE' });
            markMessageDeleted({ id: message.id, deletedAt: result.deletedAt });
            state.favorites = state.favorites.filter((item) => favoriteKey(item.kind, item.id) !== favoriteKey(kind, message.id));
            renderFavorites();
          } catch (error) {
            remove.disabled = false;
            showToast(error.message);
          }
        });
        menu.append(remove);
      }
      actions.append(summary, menu);
      body.append(actions);
      article.classList.toggle('favorite', isFavorite(kind, message.id));
    }
    article.append(avatar, body);
    elements.messages.append(article);
  };

  const markMessageDeleted = ({ id, deletedAt }) => {
    const article = Array.from(elements.messages.querySelectorAll('[data-message-id]'))
      .find((item) => item.dataset.messageId === id);
    if (!article || article.dataset.deletedAt) return;
    article.dataset.deletedAt = deletedAt || new Date().toISOString();
    const body = article.querySelector('.message-meta')?.parentElement;
    if (!body) return;
    const actions = body.querySelector('.message-actions');
    if (actions) {
      state.favorites = state.favorites.filter((item) => favoriteKey(item.kind, item.id) !== favoriteKey(actions.dataset.kind, id));
      renderFavorites();
    }
    body.querySelector('.message-content')?.remove();
    const attachment = body.querySelector('.message-attachment');
    app.releaseAttachmentElement(attachment);
    attachment?.remove();
    actions?.remove();
    article.classList.remove('favorite');
    const content = document.createElement('p');
    content.className = 'message-content';
    content.textContent = 'Messaggio eliminato';
    body.append(content);
  };

  const getCallStatusText = (call) => {
    const ownCall = call.callerId === state.user?.id;

    if (call.status === 'DECLINED') {
      return ownCall ? 'Rifiutata' : 'Rifiutata da te';
    }
    if (call.status === 'CANCELLED') return 'Annullata';
    if (call.status === 'TIMEOUT') return ownCall ? 'Senza risposta' : 'Persa';

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
    resetCall({ notifyPeer: true });
    state.activePrivateUserId = user.id;
    state.activeServerId = null;
    state.activeChannelId = null;
    state.activeConversationType = 'private';
    state.activeOverviewPanel = 'directMessages';
    state.game = null;
    renderServers();
    renderChannels();

    elements.emptyState.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    elements.superAdminPanel.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.voicePanel.classList.add('hidden');
    elements.callPanel.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.callHistory.classList.remove('hidden');
    document.querySelector('#homePanel').classList.add('hidden');
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
    loadFavorites,
    renderMessage,
    markMessageDeleted,
    getCallStatusText,
    renderCallHistory,
    loadCallHistory,
    showCallHistoryForUser
  });
};
