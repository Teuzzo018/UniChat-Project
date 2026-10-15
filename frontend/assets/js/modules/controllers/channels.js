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
    const canManageServer = Boolean(server && (server.ownerId === state.user?.id
      || server.members.some((membership) => membership.user.id === state.user?.id && membership.isAdmin)
      || state.user?.role === 'SUPERADMIN'));
    elements.copyInviteButton.disabled = !canManageServer;
    elements.inviteManage.classList.toggle('hidden', !canManageServer);
    elements.discoverabilityButton.textContent = server?.isDiscoverable ? 'Nascondi dalla ricerca' : 'Rendi scopribile';
    document.querySelector('#createChannelToggle').classList.toggle('hidden', !canManageServer);
    if (!canManageServer) {
      elements.channelForm.classList.add('hidden');
      document.querySelector('#createChannelToggle').setAttribute('aria-expanded', 'false');
    }
  
    if (!server) {
      elements.workspaceTitle.textContent = state.user?.fullName || 'Accesso';
      elements.deleteServerButton.classList.add('hidden');
      elements.copyInviteButton.disabled = true;
      renderOverviewBar();
      return;
    }
  
    elements.workspaceTitle.textContent = server.name;
    elements.deleteServerButton.textContent = server.ownerId === state.user.id ? 'Elimina server' : 'Lascia server';
  
    let lastType = null;
    [...server.channels].sort((first, second) => Number(first.type === 'VOICE') - Number(second.type === 'VOICE')).forEach((channel) => {
      if (channel.type !== lastType) {
        const heading = document.createElement('h3');
        heading.className = 'channel-group-heading';
        heading.textContent = channel.type === 'VOICE' ? 'Vocali' : 'Testuali';
        elements.channelList.append(heading);
        lastType = channel.type;
      }
      const button = document.createElement('button');
      button.className = `channel-item ${channel.id === state.activeChannelId ? 'active' : ''}`;
      button.type = 'button';
      button.textContent = `${channel.type === 'TEXT' ? '#' : '◉'} ${channel.name}`;
      button.title = channel.name;
      if (channel.id === state.activeChannelId) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => selectChannel(channel.id));
      elements.channelList.append(button);
    });
    if (!server.channels.length) {
      const empty = document.createElement('p');
      empty.className = 'sidebar-empty';
      empty.textContent = 'Nessun canale accessibile.';
      elements.channelList.append(empty);
    }
  
    server.members
      .map((membership) => membership.user)
      .forEach((member) => {
        const row = document.createElement('div');
        row.className = 'member-row';

        const isFriend = state.friends.some((friendship) => friendship.friend.id === member.id);
        const button = document.createElement(isFriend ? 'button' : 'div');
        button.className = `member-item ${member.id === state.activePrivateUserId ? 'active' : ''}`;
        if (isFriend) button.type = 'button';
        const avatar = createUserAvatar(member, 'member-avatar');
        const name = document.createElement('span');
        name.textContent = member.fullName;
        button.append(avatar, name);
        if (isFriend) button.addEventListener('click', () => selectPrivateChat(member));

        row.append(button);
        if (isFriend) {
          const historyButton = document.createElement('button');
          historyButton.className = 'member-history-button';
          historyButton.type = 'button';
          historyButton.title = 'Storico chiamate';
          historyButton.setAttribute('aria-label', `Storico chiamate con ${member.fullName}`);
          historyButton.textContent = '↺';
          historyButton.addEventListener('click', () => showCallHistoryForUser(member));
          row.append(historyButton);
        }
        elements.memberList.append(row);
      });
    if (!elements.memberList.childElementCount) {
      const empty = document.createElement('p');
      empty.className = 'sidebar-empty';
      empty.textContent = 'Nessun membro in questo server.';
      elements.memberList.append(empty);
    }
    renderOverviewBar();
  };

  const loadServers = async () => {
    state.servers = await api('/servers');
    app.setAuthenticatedUi(Boolean(state.user));

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
      loadServerJoinRequests(),
      app.loadAttachmentLimits()
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
      if (document.querySelector('#inviteDialog').open) document.querySelector('#inviteDialog').close();

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
  
    if (!server) {
      showToast('Seleziona prima un server');
      return;
    }
    let invite;
    try { invite = await api(`/servers/${server.id}/invite`); }
    catch (error) { showToast(error.message); return; }
    if (!invite.active) { showToast('Invito non attivo: creane uno nuovo'); return; }
  
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${invite.inviteCode}`;
  
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('Link invito copiato');
    } catch {
      elements.inviteCodeInput.value = inviteUrl;
      showToast('Link inserito nel campo invito');
    }
  };

  elements.rotateInviteButton.addEventListener('click', async () => {
    const server = activeServer();
    if (!server) return;
    const expiry = elements.inviteExpiresAt.value;
    const max = elements.inviteMaxUses.value;
    try {
      await api(`/servers/${server.id}/invite`, { method: 'POST', body: JSON.stringify({
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
        maxUses: max ? Number(max) : null
      }) });
      showToast('Nuovo invito creato; il precedente non è più valido');
    } catch (error) { showToast(error.message); }
  });
  elements.revokeInviteButton.addEventListener('click', async () => {
    const server = activeServer();
    if (!server) return;
    try {
      await api(`/servers/${server.id}/invite`, { method: 'DELETE' });
      showToast('Invito revocato');
    } catch (error) { showToast(error.message); }
  });
  elements.discoverabilityButton.addEventListener('click', async () => {
    const server = activeServer();
    if (!server) return;
    try {
      const result = await api(`/servers/${server.id}/discoverability`, { method: 'PATCH',
        body: JSON.stringify({ isDiscoverable: !server.isDiscoverable }) });
      server.isDiscoverable = result.isDiscoverable;
      renderChannels();
      showToast(result.isDiscoverable ? 'Server visibile nella ricerca' : 'Server nascosto dalla ricerca');
    } catch (error) { showToast(error.message); }
  });

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
