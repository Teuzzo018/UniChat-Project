/**
 * ============================================================================
 * CONTROLLER CANALI (channels.js)
 * 1. Rendering canali: visualizzazione canali testuali e vocali del server attivo
 * 2. Gestione permessi: verifica diritti di amministrazione/moderazione canale
 * 3. Modifica canali: rinomina ed eliminazione con conferma ed eventi realtime
 * ============================================================================
 */
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
  const renameDialog = document.querySelector('#renameChannelDialog');
  const renameForm = document.querySelector('#renameChannelForm');
  const renameInput = document.querySelector('#renameChannelName');
  let channelToRename = null;
  let activeChannelMenu = null;

  const closeChannelMenu = (restoreFocus = false) => {
    if (!activeChannelMenu) return;
    activeChannelMenu.actions.classList.add('hidden');
    elements.channelList.classList.remove('menu-open');
    if (restoreFocus) activeChannelMenu.button.focus();
    activeChannelMenu = null;
  };
  document.addEventListener('pointerdown', (event) => {
    if (activeChannelMenu && !activeChannelMenu.actions.contains(event.target)) closeChannelMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeChannelMenu) closeChannelMenu(true);
  });

  const applyChannelUpdated = (updated) => {
    const server = state.servers.find((item) => item.id === updated.serverId);
    const channel = server?.channels.find((item) => item.id === updated.id);
    if (!channel) return;
    channel.name = updated.name;
    if (state.activeServerId === server.id) renderChannels();
    if (state.activeChannelId === channel.id) elements.channelTitle.textContent = channel.name;
  };

  const applyChannelDeleted = async ({ id, serverId }) => {
    const server = state.servers.find((item) => item.id === serverId);
    if (!server?.channels.some((channel) => channel.id === id)) return;
    server.channels = server.channels.filter((channel) => channel.id !== id);
    if (state.voice.channelId === id) await app.leaveVoiceChannel();
    if (state.activeServerId === serverId && state.activeChannelId === id) {
      await app.selectServer(serverId);
      return;
    }
    if (state.activeServerId === serverId) renderChannels();
  };

  const openRenameChannel = (server, channel) => {
    channelToRename = { serverId: server.id, channelId: channel.id };
    renameInput.value = channel.name;
    renameDialog.showModal();
    renameInput.focus();
    renameInput.select();
  };

  renameForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!channelToRename) return;
    const submit = renameForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const updated = await api(`/admin/servers/${channelToRename.serverId}/channels/${channelToRename.channelId}`, {
        method: 'PATCH', body: JSON.stringify({ name: renameInput.value })
      });
      renameDialog.close();
      applyChannelUpdated(updated);
      showToast('Canale rinominato');
    } catch (error) { showToast(error.message); }
    finally { submit.disabled = false; }
  });
  document.querySelector('#closeRenameChannelDialog').addEventListener('click', () => renameDialog.close());
  renameDialog.addEventListener('close', () => { channelToRename = null; });

  const deleteChannel = async (server, channel) => {
    if (!await showConfirm(`Eliminare il canale ${channel.name} e tutti i suoi messaggi?`, 'Elimina canale')) return;
    try {
      await api(`/admin/servers/${server.id}/channels/${channel.id}`, { method: 'DELETE' });
      await applyChannelDeleted({ id: channel.id, serverId: server.id });
      showToast('Canale eliminato');
    } catch (error) { showToast(error.message); }
  };

  const renderChannels = () => {
    closeChannelMenu();
    const server = activeServer();
    elements.channelList.replaceChildren();
    elements.memberList.replaceChildren();
    elements.copyInviteButton.disabled = !server;
    elements.deleteServerButton.classList.toggle('hidden', !server);
    const canManageServer = Boolean(server && (server.ownerId === state.user?.id
      || server.members.some((membership) => membership.user.id === state.user?.id && membership.isAdmin)
      || state.user?.role === 'SUPERADMIN'));
    const canModerateChannel = canManageServer || ['ADMIN', 'PLATFORM_ADMIN'].includes(state.user?.role);
    elements.copyInviteButton.disabled = !canManageServer;
    elements.inviteManage.classList.toggle('hidden', !canManageServer);
    elements.discoverabilityButton.textContent = server?.isDiscoverable ? 'Nascondi dalla ricerca' : 'Rendi scopribile';
    document.querySelector('#createChannelToggle').classList.toggle('hidden', !canManageServer);
    if (!canManageServer) {
      elements.channelForm.classList.add('hidden');
      document.querySelector('#createChannelToggle').setAttribute('aria-expanded', 'false');
    }
  
    if (!server) {
      elements.workspaceTitle.textContent = state.user ? 'Panoramica' : 'Accesso';
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
        heading.textContent = channel.type === 'VOICE' ? 'Chat vocali' : 'Testuali';
        elements.channelList.append(heading);
        lastType = channel.type;
      }
      const button = document.createElement('button');
      button.className = `channel-item ${channel.id === state.activeChannelId ? 'active' : ''}`;
      button.type = 'button';
      button.textContent = `${channel.type === 'TEXT' ? '#' : '◉'} ${channel.name}`;
      const unread = channel.type === 'TEXT' ? state.unread?.channels?.[channel.id] || 0 : 0;
      if (unread) {
        const badge = document.createElement('strong');
        badge.className = 'unread-badge';
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.setAttribute('aria-label', `${unread} messaggi non letti`);
        button.append(badge);
      }
      button.title = canModerateChannel ? `${channel.name} · clic destro per le azioni` : channel.name;
      if (channel.id === state.activeChannelId) button.setAttribute('aria-current', 'page');
      let suppressClick = false;
      button.addEventListener('click', (event) => {
        if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
        selectChannel(channel.id);
      });
      const row = document.createElement('div');
      row.className = 'channel-row';
      row.append(button);
      if (canModerateChannel) {
        const menu = document.createElement('div');
        menu.className = 'channel-actions';
        const actions = document.createElement('div');
        actions.className = 'channel-actions-menu hidden';
        actions.setAttribute('role', 'menu');
        actions.setAttribute('aria-label', `Azioni per il canale ${channel.name}`);
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.setAttribute('role', 'menuitem');
        rename.textContent = 'Rinomina';
        rename.addEventListener('click', () => { closeChannelMenu(); openRenameChannel(server, channel); });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('role', 'menuitem');
        remove.className = 'danger';
        remove.textContent = 'Elimina';
        remove.addEventListener('click', () => { closeChannelMenu(); deleteChannel(server, channel); });
        actions.append(rename, remove);
        menu.append(actions);
        const openChannelMenu = () => {
          closeChannelMenu();
          actions.classList.remove('hidden');
          activeChannelMenu = { actions, button };
          elements.channelList.classList.add('menu-open');
          actions.scrollIntoView({ block: 'nearest' });
          rename.focus();
        };
        button.addEventListener('contextmenu', (event) => { event.preventDefault(); openChannelMenu(); });
        button.addEventListener('keydown', (event) => {
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
          event.preventDefault();
          openChannelMenu();
        });
        let longPressTimer = null;
        button.addEventListener('pointerdown', (event) => {
          if (event.pointerType !== 'touch') return;
          longPressTimer = window.setTimeout(() => { suppressClick = true; openChannelMenu(); }, 500);
        });
        for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
          button.addEventListener(type, () => window.clearTimeout(longPressTimer));
        }
        row.append(menu);
      }
      elements.channelList.append(row);
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
      app.loadPrivateConversations(),
      app.loadUnread(),
      loadServerJoinRequests(),
      app.loadAttachmentLimits(),
      app.loadFavorites().catch((error) => showToast(`Preferiti non disponibili: ${error.message}`))
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
      if (!document.querySelector('#serverSettingsDialog').open) app.openServerSettings(server);
      const link = document.querySelector('#serverInviteLink');
      link.value = inviteUrl;
      link.classList.remove('hidden');
      link.focus();
      link.select();
      showToast('Seleziona e copia il link invito');
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
    applyChannelDeleted,
    applyChannelUpdated,
    renderChannels,
    loadServers,
    loadWorkspaceData,
    joinServerByInvite,
    copyActiveServerInvite,
    deleteOrLeaveActiveServer
  });
};
