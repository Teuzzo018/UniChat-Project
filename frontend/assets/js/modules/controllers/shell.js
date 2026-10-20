export const registerShellController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeServer = (...args) => app.activeServer(...args);
  const leaveVoiceChannel = (...args) => app.leaveVoiceChannel(...args);
  const resetCall = (...args) => app.resetCall(...args);
  const renderServers = (...args) => app.renderServers(...args);
  const renderChannels = (...args) => app.renderChannels(...args);
  const loadMessages = (...args) => app.loadMessages(...args);
  const showAdminPanel = (...args) => app.showAdminPanel(...args);
  const isGlobalAdmin = (user) => ['ADMIN', 'PLATFORM_ADMIN'].includes(user?.role) ||
    (user?.role === 'SUPERADMIN' && user.email?.toLowerCase() === 'teo.sisto.04@gmail.com');

  const updateVoiceAudioState = () => {
    app.syncVoiceMic?.();
    state.call.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !state.userDock.muted && !state.userDock.deafened;
    });

    elements.remoteAudio.querySelectorAll('audio').forEach((audio) => {
      audio.muted = state.userDock.deafened;
    });
    elements.remoteVideo.muted = state.userDock.deafened;
    document.querySelector('#remoteCallAudio').muted = state.userDock.deafened;
  };

  const renderUserDock = () => {
    const authenticated = Boolean(state.user);

    elements.userDock.classList.toggle('hidden', !authenticated);

    if (!authenticated) {
      return;
    }

    renderAvatarContent(elements.profileAvatar, state.user);
    elements.profileName.textContent = state.user.fullName;
    elements.profileRole.textContent = ({
      STUDENT: 'Studente',
      PROFESSOR: 'Professore',
      ADMIN: 'Admin piattaforma',
      PLATFORM_ADMIN: 'Admin piattaforma',
      SUPERADMIN: 'SuperAdmin'
    })[state.user.role] || 'Utente';
    elements.profileButton.setAttribute('aria-label', `Apri profilo di ${state.user.fullName}`);

    elements.muteButton.classList.toggle('active', state.userDock.muted);
    elements.muteButton.setAttribute('aria-pressed', String(state.userDock.muted));
    elements.muteButton.title = state.userDock.muted ? 'Riattiva microfono' : 'Disattiva microfono';
    elements.muteButton.setAttribute('aria-label', state.userDock.muted ? 'Riattiva microfono' : 'Disattiva microfono');

    elements.deafenButton.classList.toggle('active', state.userDock.deafened);
    elements.deafenButton.setAttribute('aria-pressed', String(state.userDock.deafened));
    elements.deafenButton.title = state.userDock.deafened ? 'Riattiva audio' : 'Disattiva audio';
    elements.deafenButton.setAttribute('aria-label', state.userDock.deafened ? 'Riattiva audio' : 'Disattiva audio');

    elements.muteButton.classList.remove('hidden');
    elements.deafenButton.classList.remove('hidden');
    elements.permissionsButton.classList.toggle('hidden', !isGlobalAdmin(state.user));
    const managementLabel = state.user.role === 'SUPERADMIN' ? 'Pannello SuperAdmin' : 'Pannello Admin';
    elements.permissionsButton.title = managementLabel;
    elements.permissionsButton.setAttribute('aria-label', managementLabel);
    updateVoiceAudioState();
    if (state.call.id && !elements.callPanel.classList.contains('hidden')) app.showCallPanel(elements.callStatus.textContent);
  };

  const renderOverviewBar = () => {
    const authenticated = Boolean(state.user);
    const server = activeServer();

    elements.overviewBar.classList.toggle('hidden', !authenticated);
    elements.contentArea.classList.toggle('has-overview', authenticated);
    if (authenticated && !server && state.activeOverviewPanel === 'channels') state.activeOverviewPanel = 'directMessages';
    app.renderLayout?.();

    if (!authenticated) {
      state.activeOverviewPanel = null;
      elements.overviewPanel.classList.add('hidden');
      return;
    }

    setBadgeCount(elements.channelsBadge, server?.channels.length || 0);
    setBadgeCount(elements.friendSearchBadge, state.friends.length);
    setBadgeCount(elements.friendRequestsBadge, state.friendRequests.length);
    setBadgeCount(elements.serverRequestsBadge, state.serverJoinRequests.length);
    setBadgeCount(elements.availableServersBadge, state.availableServers.length);

    elements.overviewTabs.forEach((button) => {
      button.classList.toggle('active', button.dataset.overviewPanel === state.activeOverviewPanel);
      button.classList.toggle('hidden', button.dataset.overviewPanel === 'channels' && !server);
      button.setAttribute('aria-pressed', String(button.dataset.overviewPanel === state.activeOverviewPanel));
    });

    elements.overviewPanel.classList.toggle('hidden', !state.activeOverviewPanel);
    elements.overviewSections.forEach((section) => {
      section.classList.toggle('hidden', section.dataset.overviewContent !== state.activeOverviewPanel);
    });
  };

  const toggleOverviewPanel = (panelName) => {
    state.activeOverviewPanel = panelName;
    renderOverviewBar();
  };

  const closeOverviewPanel = () => {
    if (!state.activeOverviewPanel) {
      return;
    }

    state.activeOverviewPanel = null;
    renderOverviewBar();
  };

  const closeOverviewPanelOnOutsideClick = (event) => {
    if (elements.overviewBar.classList.contains('sidebar-overview')) return;
    if (
      !state.activeOverviewPanel
      || elements.overviewBar.classList.contains('hidden')
      || elements.overviewBar.contains(event.target)
    ) {
      return;
    }

    closeOverviewPanel();
  };

  const setDefaultEmptyState = () => {
    elements.emptyState.querySelector('h2').textContent = state.user ? 'Benvenuto su UniChat' : 'Chat universitaria senza distrazioni';
    elements.emptyState.querySelector('p').textContent = state.user
      ? 'Crea un server, usa un link invito o aggiungi amici per iniziare.'
      : 'Server per corsi, canali testuali e vocali, messaggi in tempo reale e accesso tramite account.';
  };

  const showHome = async () => {
    await leaveVoiceChannel();
    resetCall({ notifyPeer: true });
    state.activeServerId = null;
    state.activeChannelId = null;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.activeOverviewPanel = 'directMessages';
    state.game = null;
    renderServers();
    renderChannels();
    await loadMessages();
    app.closeMobileNav?.();
  };

  const setAuthenticatedUi = (authenticated) => {
    elements.authPanel.classList.toggle('hidden', authenticated);
    elements.workspacePanel.classList.toggle('hidden', !authenticated);
    elements.logoutButton.classList.toggle('hidden', !authenticated);
    elements.globalSearchButton.classList.toggle('hidden', !authenticated);
    if (!authenticated && elements.globalSearchDialog.open) elements.globalSearchDialog.close();
    elements.videoCallButton.classList.toggle('hidden', state.activeConversationType !== 'private' || !state.activePrivateUserId);
    document.querySelector('#audioCallButton').classList.toggle('hidden', state.activeConversationType !== 'private' || !state.activePrivateUserId);
    elements.workspaceTitle.textContent = authenticated ? 'Panoramica' : 'Accesso';
    renderUserDock();
    renderOverviewBar();
  };

  const toggleMute = () => {
    state.userDock.muted = !state.userDock.muted;
    renderUserDock();
    showToast(state.userDock.muted ? 'Microfono disattivato' : 'Microfono riattivato');
  };

  const toggleDeafen = () => {
    state.userDock.deafened = !state.userDock.deafened;

    if (state.userDock.deafened) {
      state.userDock.muted = true;
    }

    renderUserDock();
    showToast(state.userDock.deafened ? 'Audio disattivato' : 'Audio riattivato');
  };

  const showUserProfile = () => {
    if (!state.user) {
      return;
    }

    const server = activeServer();
    const role = state.user.role === 'SUPERADMIN' ? 'Creator'
      : ['ADMIN', 'PLATFORM_ADMIN'].includes(state.user.role) ? 'Admin piattaforma' : 'Utente';
    showToast(`${state.user.fullName} ${getDisplayHandle(state.user)} - ${role}${server ? ` in ${server.name}` : ''}`);
  };

  const openPermissionsPanel = () => {
    if (['ADMIN', 'PLATFORM_ADMIN'].includes(state.user?.role)) {
      showAdminPanel();
      return;
    }
    if (state.user?.role === 'SUPERADMIN' && state.user.email?.toLowerCase() === 'teo.sisto.04@gmail.com') {
      app.showSuperAdminPanel();
    }
  };

  Object.assign(app, {
    updateVoiceAudioState,
    renderUserDock,
    renderOverviewBar,
    toggleOverviewPanel,
    closeOverviewPanel,
    closeOverviewPanelOnOutsideClick,
    setDefaultEmptyState,
    showHome,
    setAuthenticatedUi,
    toggleMute,
    toggleDeafen,
    showUserProfile,
    openPermissionsPanel
  });
};
