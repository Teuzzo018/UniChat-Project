import { setupGameButtonControllers } from './gameButtonControllers.js';

export const setupEventListeners = ({
  elements,
  api,
  state,
  setAuthenticatedUi,
  connectSocket,
  loadWorkspaceData,
  showToast,
  loadUniversities,
  leaveVoiceChannel,
  resetCall,
  renderServers,
  renderChannels,
  renderFriends,
  renderServerJoinRequests,
  loadMessages,
  openUserSettings,
  openGameDialog,
  sendGameLinkToChat,
  showUserProfile,
  toggleMute,
  toggleDeafen,
  openPermissionsPanel,
  toggleOverviewPanel,
  closeOverviewPanelOnOutsideClick,
  updateProfileSettings,
  renderAvatarContent,
  renderGameLauncher,
  copyActiveServerInvite,
  deleteOrLeaveActiveServer,
  joinServerByInvite,
  addFriend,
  toggleFriends,
  searchFriends,
  activeServer,
  selectServer,
  renderAvailableServers,
  selectChannel,
  buildMessageFormData,
  getSlashCommand,
  runSlashCommand,
  sendMessageWithUpload,
  clearComposer,
  validateAttachment,
  renderSelectedAttachment,
  answerGameInvite,
  restartGame,
  closeGame,
  startVideoCall,
  acceptVideoCall,
  declineVideoCall,
  joinVoiceChannel,
  showHome
}) => {
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-auth-tab]').forEach((tab) => tab.classList.remove('active'));
      button.classList.add('active');
      elements.loginForm.classList.toggle('hidden', button.dataset.authTab !== 'login');
      elements.registerForm.classList.toggle('hidden', button.dataset.authTab !== 'register');
    });
  });
  
  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
  
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form))
      });
      state.token = result.token;
      localStorage.setItem('unichat:token', result.token);
      state.user = result.user;
      state.activeOverviewPanel = 'directMessages';
      state.friendsExpanded = true;
      setAuthenticatedUi(true);
      connectSocket();
      await loadWorkspaceData();
    } catch (error) {
      showToast(error.message);
    }
  });

  
  const registerEmailInput = elements.registerForm.querySelector('input[name="email"]');
  const registerEmailError = elements.registerForm.querySelector('#registerEmailError');
  registerEmailInput.addEventListener('input', () => {
    registerEmailError.textContent = '';
    registerEmailError.classList.add('hidden');
  });
  elements.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const payload = new FormData();

      form.forEach((value, key) => {
        if (value instanceof File && !value.name) {
          return;
        }

        payload.append(key, value);
      });

      if (state.pendingInviteCode) {
        payload.append('inviteCode', state.pendingInviteCode);
      }

      await api('/auth/register', {
        method: 'POST',
        body: payload
      });
      registerEmailError.textContent = '';
      registerEmailError.classList.add('hidden');
      showToast('Account creato. Ora puoi effettuare il login.');
      document.querySelector('[data-auth-tab="login"]').click();
    } catch (error) {
      if (error.code === 'EMAIL_ALREADY_REGISTERED') {
        registerEmailError.textContent = error.message;
        registerEmailError.classList.remove('hidden');
        registerEmailInput.focus();
        registerEmailInput.select();
      }
      showToast(error.message);
    }
  });
  
  elements.logoutButton.addEventListener('click', async () => {
    await leaveVoiceChannel();
    resetCall({ notifyPeer: true });

    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
    }
  
    state.token = null;
    state.user = null;
    state.servers = [];
    state.availableServers = [];
    state.friends = [];
    state.privateConversations = [];
    state.favorites = [];
    if (document.querySelector('#favoritesDialog').open) document.querySelector('#favoritesDialog').close();
    state.friendPresence = {};
    state.friendRequests = [];
    state.friendsExpanded = false;
    state.friendSearchResults = [];
    state.serverJoinRequests = [];
    state.blockedUsers = [];
    state.activeOverviewPanel = null;
    state.activeServerId = null;
    state.activeChannelId = null;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.game = null;
    state.userDock.muted = false;
    state.userDock.deafened = false;
    state.socket?.disconnect();
    localStorage.removeItem('unichat:token');
    setAuthenticatedUi(false);
    renderServers();
    renderChannels();
    renderFriends();
    renderServerJoinRequests();
    elements.gamePanel.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    elements.superAdminPanel.classList.add('hidden');
    await loadMessages();
  });
  
  const openServerDialog = async () => {
    const creator = state.user?.role === 'SUPERADMIN' && state.user.email?.toLowerCase() === 'teo.sisto.04@gmail.com';
    const field = document.querySelector('#creatorServerUniversityField');
    const select = document.querySelector('#creatorServerUniversity');
    field.classList.toggle('hidden', !creator);
    select.disabled = !creator;
    select.required = creator;
    if (creator) {
      try {
        const universities = await api('/universities');
        if (!universities.length) {
          showToast('Crea prima un’università dal Pannello SuperAdmin');
          return;
        }
        select.replaceChildren();
        for (const university of universities) {
          const option = document.createElement('option');
          option.value = university.id;
          option.textContent = university.name;
          select.append(option);
        }
      } catch (error) { showToast(error.message); return; }
    }
    elements.serverDialog.showModal();
  };
  
  elements.newServerButton.addEventListener('click', openServerDialog);
  elements.gameRailButton.addEventListener('click', openGameDialog);
  setupGameButtonControllers(elements.gameRailButton);
  elements.sendGameLinkButton.addEventListener('click', sendGameLinkToChat);
  document.querySelector('#closeGameDialog').addEventListener('click', () => elements.gameDialog.close());
  elements.profileButton.addEventListener('click', showUserProfile);
  elements.muteButton.addEventListener('click', toggleMute);
  elements.deafenButton.addEventListener('click', toggleDeafen);
  elements.permissionsButton.addEventListener('click', openPermissionsPanel);
  elements.settingsButton.addEventListener('click', openUserSettings);
  elements.overviewTabs.forEach((button) => {
    button.addEventListener('click', () => toggleOverviewPanel(button.dataset.overviewPanel));
  });
  document.addEventListener('click', closeOverviewPanelOnOutsideClick);
  document.querySelector('#closeSettingsDialog').addEventListener('click', () => elements.settingsDialog.close());
  elements.settingsProfileForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await updateProfileSettings();
    } catch (error) {
      showToast(error.message);
    }
  });
  elements.settingsFullName.addEventListener('input', () => {
    elements.settingsPreviewName.textContent = elements.settingsFullName.value || state.user?.fullName || 'Utente';
  });
  elements.settingsAvatarFile.addEventListener('change', () => {
    const file = elements.settingsAvatarFile.files[0];

    if (!file) {
      renderAvatarContent(elements.settingsAvatarPreview, state.user);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    renderAvatarContent(elements.settingsAvatarPreview, {
      ...state.user,
      avatarUrl: previewUrl
    });
  });
  elements.gameTypeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedGameType = button.dataset.gameType || 'TICTACTOE';
      renderGameLauncher();
    });
  });
  elements.createServerFromSidebar.addEventListener('click', openServerDialog);
  elements.copyInviteButton.addEventListener('click', copyActiveServerInvite);
  elements.deleteServerButton.addEventListener('click', async () => {
    const previousServerId = state.activeServerId;
    await deleteOrLeaveActiveServer();
    const dialog = document.querySelector('#serverSettingsDialog');
    if (dialog.open && previousServerId !== state.activeServerId) dialog.close();
  });
  document.querySelector('#closeServerDialog').addEventListener('click', () => elements.serverDialog.close());
  
  elements.inviteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await joinServerByInvite(elements.inviteCodeInput.value);
  });

  elements.friendForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.friendsExpanded = true;
    await addFriend(elements.friendUsernameInput.value);
  });

  elements.friendCounterButton.addEventListener('click', toggleFriends);

  elements.friendUsernameInput.addEventListener('input', () => {
    searchFriends(elements.friendUsernameInput.value).catch((error) => showToast(error.message));
  });
  
  elements.serverForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
  
    try {
      const server = await api('/servers', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form))
      });
      state.servers.push(server);
      state.availableServers = state.availableServers.filter((availableServer) => availableServer.id !== server.id);
      state.activeServerId = server.id;
      elements.serverDialog.close();
      elements.serverForm.reset();
      renderServers();
      renderAvailableServers();
      await selectServer(server.id);
    } catch (error) {
      showToast(error.message);
    }
  });
  
  elements.channelForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const server = activeServer();
  
    if (!server) {
      showToast('Crea prima un server');
      return;
    }
  
    const form = new FormData(event.currentTarget);
  
    try {
      const channel = await api(`/servers/${server.id}/channels`, {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form))
      });
      server.channels.push(channel);
      elements.channelForm.reset();
      elements.channelForm.classList.add('hidden');
      document.querySelector('#createChannelToggle').setAttribute('aria-expanded', 'false');
      await selectChannel(channel.id);
    } catch (error) {
      showToast(error.message);
    }
  });
  
  elements.messageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { formData, content, file, valid } = buildMessageFormData();
    const command = state.activeConversationType === 'private' && !file ? getSlashCommand(content) : null;
    const commandPeerId = state.activePrivateUserId;

    if (!valid) {
      return;
    }

    if (!content && !file) {
      return;
    }

    if (state.activeConversationType === 'private' || file) {
      try {
        const sentMessage = await sendMessageWithUpload({ formData, file });
        if (!sentMessage) return;
      } catch (error) {
        showToast(error.message);
        return;
      }
      clearComposer();
      if (command && state.activeConversationType === 'private' && state.activePrivateUserId === commandPeerId) {
        runSlashCommand(command);
      }
      return;
    }

    if (!state.activeChannelId) {
      return;
    }

    state.socket.emit('send_message', {
      token: state.token,
      channelId: state.activeChannelId,
      content
    }, (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Messaggio non inviato');
        return;
      }
      clearComposer();
    });
  });

  elements.messageFileInput.addEventListener('change', () => {
    const file = elements.messageFileInput.files[0];

    if (!file) {
      renderSelectedAttachment();
      return;
    }

    if (!validateAttachment(file)) {
      elements.messageFileInput.value = '';
      renderSelectedAttachment();
      return;
    }

    renderSelectedAttachment();
    showToast(`Allegato selezionato: ${file.name}`);
  });
  
  elements.homeButton.addEventListener('click', () => {
    showHome();
  });
  
  elements.acceptGameButton.addEventListener('click', () => answerGameInvite(true));
  elements.declineGameButton.addEventListener('click', () => answerGameInvite(false));
  elements.restartGameButton.addEventListener('click', restartGame);
  elements.closeGameButton.addEventListener('click', closeGame);
  elements.videoCallButton.addEventListener('click', () => startVideoCall('video'));
  elements.acceptCallButton.addEventListener('click', acceptVideoCall);
  elements.declineCallButton.addEventListener('click', declineVideoCall);
  elements.endCallButton.addEventListener('click', () => {
    resetCall({ notifyPeer: true });
    loadMessages();
  });
  elements.joinVoiceButton.addEventListener('click', joinVoiceChannel);
  elements.leaveVoiceButton.addEventListener('click', () => leaveVoiceChannel({ reopenPreview: true }));
  

};
