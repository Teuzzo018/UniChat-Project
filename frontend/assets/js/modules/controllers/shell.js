export const registerShellController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeServer = (...args) => app.activeServer(...args);
  const leaveVoiceChannel = (...args) => app.leaveVoiceChannel(...args);
  const resetCall = (...args) => app.resetCall(...args);
  const renderServers = (...args) => app.renderServers(...args);
  const renderChannels = (...args) => app.renderChannels(...args);
  const loadMessages = (...args) => app.loadMessages(...args);
  const showAdminPanel = (...args) => app.showAdminPanel(...args);

  const updateVoiceAudioState = () => {
    state.voice.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !state.userDock.muted && !state.userDock.deafened;
    });

    elements.remoteAudio.querySelectorAll('audio').forEach((audio) => {
      audio.muted = state.userDock.deafened;
    });
  };

  const renderUserDock = () => {
    const authenticated = Boolean(state.user);

    elements.userDock.classList.toggle('hidden', !authenticated);

    if (!authenticated) {
      return;
    }

    renderAvatarContent(elements.profileAvatar, state.user);
    elements.profileName.textContent = state.user.fullName;
    elements.profileHandle.textContent = getDisplayHandle(state.user);

    elements.muteButton.classList.toggle('active', state.userDock.muted);
    elements.muteButton.setAttribute('aria-pressed', String(state.userDock.muted));
    elements.muteButton.title = state.userDock.muted ? 'Riattiva microfono' : 'Disattiva microfono';
    elements.muteButton.setAttribute('aria-label', state.userDock.muted ? 'Riattiva microfono' : 'Disattiva microfono');

    elements.deafenButton.classList.toggle('active', state.userDock.deafened);
    elements.deafenButton.setAttribute('aria-pressed', String(state.userDock.deafened));
    elements.deafenButton.title = state.userDock.deafened ? 'Riattiva audio' : 'Disattiva audio';
    elements.deafenButton.setAttribute('aria-label', state.userDock.deafened ? 'Riattiva audio' : 'Disattiva audio');

    elements.permissionsButton.classList.toggle('active', state.user.role === 'ADMIN');
    updateVoiceAudioState();
  };

  const renderOverviewBar = () => {
    const authenticated = Boolean(state.user);
    const server = activeServer();

    elements.overviewBar.classList.toggle('hidden', !authenticated);
    elements.contentArea.classList.toggle('has-overview', authenticated);

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
    });

    elements.overviewPanel.classList.toggle('hidden', !state.activeOverviewPanel);
    elements.overviewSections.forEach((section) => {
      section.classList.toggle('hidden', section.dataset.overviewContent !== state.activeOverviewPanel);
    });
  };

  const toggleOverviewPanel = (panelName) => {
    state.activeOverviewPanel = state.activeOverviewPanel === panelName ? null : panelName;
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
    elements.emptyState.querySelector('h2').textContent = state.user ? 'Home' : 'Chat universitaria senza distrazioni';
    elements.emptyState.querySelector('p').textContent = state.user
      ? 'Crea un server, usa un link invito o aggiungi amici per iniziare.'
      : 'Server per corsi, canali testuali e vocali, messaggi in tempo reale e accesso tramite account.';
  };

  const showHome = async () => {
    await leaveVoiceChannel();
    resetCall();
    state.activeServerId = null;
    state.activeChannelId = null;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.game = null;
    renderServers();
    renderChannels();
    await loadMessages();
  };

  const setAuthenticatedUi = (authenticated) => {
    elements.authPanel.classList.toggle('hidden', authenticated);
    elements.workspacePanel.classList.toggle('hidden', !authenticated);
    elements.logoutButton.classList.toggle('hidden', !authenticated);
    elements.adminButton.classList.toggle('hidden', !authenticated || state.user?.role !== 'ADMIN');
    elements.videoCallButton.classList.toggle('hidden', state.activeConversationType !== 'private' || !state.activePrivateUserId);
    elements.workspaceTitle.textContent = authenticated ? state.user.fullName : 'Accesso';
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
    const role = state.user.role === 'ADMIN' ? 'Admin' : 'Utente';
    showToast(`${state.user.fullName} ${getDisplayHandle(state.user)} - ${role}${server ? ` in ${server.name}` : ''}`);
  };

  const openPermissionsPanel = () => {
    if (state.user?.role === 'ADMIN') {
      showAdminPanel();
      return;
    }

    showToast('Permessi standard: puoi creare server, canali, chat e giochi.');
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
