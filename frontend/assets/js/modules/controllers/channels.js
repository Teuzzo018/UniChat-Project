export const registerChannelsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeServer = (...args) => app.activeServer(...args);
  const selectPrivateChat = (...args) => app.selectPrivateChat(...args);
  const showCallHistoryForUser = (...args) => app.showCallHistoryForUser(...args);
  const loadMessages = (...args) => app.loadMessages(...args);
  const extractInviteCode = (...args) => app.extractInviteCode(...args);
  const clearInviteFromUrl = (...args) => app.clearInviteFromUrl(...args);
  const renderOverviewBar = (...args) => app.renderOverviewBar(...args);
  const selectServer = (...args) => app.selectServer(...args);
  const renderServers = (...args) => app.renderServers(...args);
  const renderAvailableServers = (...args) => app.renderAvailableServers(...args);
  const loadAvailableServers = (...args) => app.loadAvailableServers(...args);
  const loadFriends = (...args) => app.loadFriends(...args);
  const loadServerJoinRequests = (...args) => app.loadServerJoinRequests(...args);
  const addOrReplaceServer = (...args) => app.addOrReplaceServer(...args);
  const selectChannel = (...args) => app.selectChannel(...args);

  const renderChannels = () => {
    const server = activeServer();
    elements.channelList.replaceChildren();
    elements.memberList.replaceChildren();
    elements.copyInviteButton.disabled = !server;
    elements.deleteServerButton.classList.toggle('hidden', !server);
  
    if (!server) {
      elements.workspaceTitle.textContent = state.user?.fullName || 'Accesso';
      elements.deleteServerButton.classList.add('hidden');
      elements.copyInviteButton.disabled = true;
      renderOverviewBar();
      return;
    }
  
    elements.workspaceTitle.textContent = server.name;
    elements.deleteServerButton.textContent = server.ownerId === state.user.id ? 'Elimina server' : 'Lascia server';
  
    server.channels.forEach((channel) => {
      const button = document.createElement('button');
      button.className = `channel-item ${channel.id === state.activeChannelId ? 'active' : ''}`;
      button.type = 'button';
      button.textContent = `${channel.type === 'TEXT' ? '#' : '◉'} ${channel.name}`;
      button.addEventListener('click', () => selectChannel(channel.id));
      elements.channelList.append(button);
    });
  
    server.members
      .map((membership) => membership.user)
      .filter((member) => member.id !== state.user.id)
      .forEach((member) => {
        const row = document.createElement('div');
        row.className = 'member-row';

        const button = document.createElement('button');
        button.className = `member-item ${member.id === state.activePrivateUserId ? 'active' : ''}`;
        button.type = 'button';
        const avatar = createUserAvatar(member, 'member-avatar');
        const name = document.createElement('span');
        name.textContent = member.fullName;
        button.append(avatar, name);
        button.addEventListener('click', () => selectPrivateChat(member));

        const historyButton = document.createElement('button');
        historyButton.className = 'member-history-button';
        historyButton.type = 'button';
        historyButton.title = 'Storico chiamate';
        historyButton.textContent = '↺';
        historyButton.addEventListener('click', () => showCallHistoryForUser(member));

        row.append(button, historyButton);
        elements.memberList.append(row);
      });
    renderOverviewBar();
  };

  const loadServers = async () => {
    state.servers = await api('/servers');

    if (state.activeServerId && !state.servers.some((server) => server.id === state.activeServerId)) {
      state.activeServerId = null;
    }

    renderServers();
    renderChannels();
    await loadMessages();
    await loadAvailableServers();

    if (state.pendingInviteCode) {
      await joinServerByInvite(state.pendingInviteCode);
    }
  };

  const loadWorkspaceData = async () => {
    await Promise.all([
      loadServers(),
      loadFriends(),
      loadServerJoinRequests()
    ]);
  };

  const joinServerByInvite = async (rawInviteCode) => {
    const inviteCode = extractInviteCode(rawInviteCode);
  
    if (!inviteCode) {
      showToast('Inserisci un codice invito');
      return;
    }
  
    try {
      const result = await api('/servers/join-by-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode })
      });

      state.pendingInviteCode = null;
      localStorage.removeItem('unichat:pendingInviteCode');
      clearInviteFromUrl();
      elements.inviteCodeInput.value = '';

      if (result?.id) {
        addOrReplaceServer(result);
        state.availableServers = state.availableServers.filter((availableServer) => availableServer.id !== result.id);
        state.activeServerId = result.id;
        renderAvailableServers();
        renderServers();
        await selectServer(result.id);
        showToast('Sei entrato nel server tramite invito');
        return;
      }

      await loadAvailableServers();
      showToast(result.message || 'Richiesta inviata');
    } catch (error) {
      showToast(error.message);
    }
  };

  const copyActiveServerInvite = async () => {
    const server = activeServer();
  
    if (!server?.inviteCode) {
      showToast('Seleziona prima un server');
      return;
    }
  
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${server.inviteCode}`;
  
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('Link invito copiato');
    } catch {
      elements.inviteCodeInput.value = inviteUrl;
      showToast('Link inserito nel campo invito');
    }
  };

  const deleteOrLeaveActiveServer = async () => {
    const server = activeServer();
  
    if (!server) {
      showToast('Seleziona prima un server');
      return;
    }
  
    const isOwner = server.ownerId === state.user.id;
    const confirmed = await showConfirm(
      isOwner
        ? `Eliminare il server ${server.name}? Questa azione rimuove anche canali e messaggi.`
        : `Lasciare il server ${server.name}?`,
      isOwner ? 'Elimina server' : 'Lascia server'
    );
  
    if (!confirmed) {
      return;
    }
  
    try {
      const result = await api(`/servers/${server.id}`, { method: 'DELETE' });
      state.servers = state.servers.filter((item) => item.id !== server.id);
      state.activeServerId = state.servers[0]?.id || null;
      state.activeChannelId = null;
      state.activePrivateUserId = null;
      state.activeConversationType = 'channel';
      state.game = null;
      renderServers();
      renderChannels();
      await selectServer(state.activeServerId);
      await loadAvailableServers();
      showToast(result.message || (isOwner ? 'Server eliminato' : 'Sei uscito dal server'));
    } catch (error) {
      showToast(error.message);
    }
  };

  Object.assign(app, {
    renderChannels,
    loadServers,
    loadWorkspaceData,
    joinServerByInvite,
    copyActiveServerInvite,
    deleteOrLeaveActiveServer
  });
};
