export const registerAdminController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeServer = (...args) => app.activeServer(...args);
  const renderServers = (...args) => app.renderServers(...args);
  const renderChannels = (...args) => app.renderChannels(...args);
  const loadAvailableServers = (...args) => app.loadAvailableServers(...args);

  const createAdminRow = ({ title, detail, actionLabel, onAction }) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
  
    const info = document.createElement('div');
  
    const titleElement = document.createElement('strong');
    titleElement.textContent = title;
  
    const detailElement = document.createElement('span');
    detailElement.textContent = detail;
  
    const button = document.createElement('button');
    button.className = 'danger-button';
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
  
    info.append(titleElement, detailElement);
    item.append(info, button);
  
    return item;
  };

  const deleteAdminResource = async ({ path, confirmMessage }) => {
    if (!await showConfirm(confirmMessage, 'Elimina')) {
      return;
    }
  
    try {
      await api(path, { method: 'DELETE' });
      await loadAdminPanel();
      state.servers = await api('/servers');
  
      if (state.activeServerId && !state.servers.some((server) => server.id === state.activeServerId)) {
        state.activeServerId = state.servers[0]?.id || null;
      }
  
      renderServers();
      renderChannels();
      await loadAvailableServers();
      showToast('Elemento eliminato');
    } catch (error) {
      showToast(error.message);
    }
  };

  const renderAdminPanel = (overview) => {
    elements.adminUsers.replaceChildren();
    elements.adminServers.replaceChildren();
    elements.adminMessages.replaceChildren();
  
    overview.users.forEach((user) => {
      elements.adminUsers.append(createAdminRow({
        title: `${user.fullName} (${user.role})`,
        detail: `${user.email} - ${user.university?.name || 'nessuna universita'}`,
        actionLabel: 'Elimina',
        onAction: () => deleteAdminResource({
          path: `/admin/users/${user.id}`,
          confirmMessage: `Eliminare l'utente ${user.fullName}?`
        })
      }));
    });
  
    overview.servers.forEach((server) => {
      elements.adminServers.append(createAdminRow({
        title: server.name,
        detail: `${server.university.name} - ${server._count.members} membri - owner ${server.owner.fullName}`,
        actionLabel: 'Elimina',
        onAction: () => deleteAdminResource({
          path: `/admin/servers/${server.id}`,
          confirmMessage: `Eliminare il server ${server.name} e i suoi messaggi?`
        })
      }));
    });
  
    overview.messages.forEach((message) => {
      elements.adminMessages.append(createAdminRow({
        title: `${message.user.fullName} in ${message.channel.server.name} / ${message.channel.name}`,
        detail: message.content,
        actionLabel: 'Elimina',
        onAction: () => deleteAdminResource({
          path: `/admin/messages/${message.id}`,
          confirmMessage: 'Eliminare questo messaggio?'
        })
      }));
    });
  };

  const loadAdminPanel = async () => {
    const overview = await api('/admin/overview');
    renderAdminPanel(overview);
  };

  const showAdminPanel = async () => {
    if (state.user?.role !== 'ADMIN') {
      return;
    }
  
    state.activeChannelId = null;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.game = null;
    elements.emptyState.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.callPanel.classList.add('hidden');
    elements.voicePanel.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.videoCallButton.classList.add('hidden');
    elements.adminPanel.classList.remove('hidden');
    elements.channelTitle.textContent = 'Pannello admin';
    elements.channelType.textContent = 'Amministrazione';
    renderChannels();
  
    try {
      await loadAdminPanel();
    } catch (error) {
      showToast(error.message);
    }
  };

  Object.assign(app, {
    createAdminRow,
    deleteAdminResource,
    renderAdminPanel,
    loadAdminPanel,
    showAdminPanel
  });
};
