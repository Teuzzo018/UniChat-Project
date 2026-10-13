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
  showAdminPanel,
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
      state.user = result.user;
      localStorage.setItem('unichat:token', result.token);
      setAuthenticatedUi(true);
      connectSocket();
      await loadWorkspaceData();
    } catch (error) {
      showToast(error.message);
    }
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
      showToast('Account creato. Ora puoi effettuare il login.');
      document.querySelector('[data-auth-tab="login"]').click();
    } catch (error) {
      showToast(error.message);
    }
  });
  
  elements.createUniversityButton.addEventListener('click', async () => {
    try {
      await api('/universities', {
        method: 'POST',
        body: JSON.stringify({
          name: elements.universityName.value,
          domain: elements.universityDomain.value
        })
      });
      elements.universityName.value = '';
      elements.universityDomain.value = '';
      await loadUniversities();
      showToast('Universita aggiunta');
    } catch (error) {
      showToast(error.message);
    }
  });
  
  elements.logoutButton.addEventListener('click', async () => {
    await leaveVoiceChannel();
    resetCall();

    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
    }
  
    state.token = null;
    state.user = null;
    state.servers = [];
    state.availableServers = [];
    state.friends = [];
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
    await loadMessages();
  });
  
  const openServerDialog = () => elements.serverDialog.showModal();
  
  elements.adminButton.addEventListener('click', showAdminPanel);
  elements.newServerButton.addEventListener('click', openServerDialog);
  elements.gameRailButton.addEventListener('click', openGameDialog);
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
  elements.deleteServerButton.addEventListener('click', deleteOrLeaveActiveServer);
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
      await selectChannel(channel.id);
    } catch (error) {
      showToast(error.message);
    }
  });
  
  elements.messageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { formData, content, file, valid } = buildMessageFormData();

    if (!valid) {
      return;
    }

    if (!content && !file) {
      return;
    }

    if (state.activeConversationType === 'private' || file) {
      try {
        await sendMessageWithUpload({ formData, file });
      } catch (error) {
        showToast(error.message);
        return;
      }
      clearComposer();
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
  elements.videoCallButton.addEventListener('click', startVideoCall);
  elements.acceptCallButton.addEventListener('click', acceptVideoCall);
  elements.declineCallButton.addEventListener('click', declineVideoCall);
  elements.endCallButton.addEventListener('click', () => {
    resetCall({ notifyPeer: true });
    loadMessages();
  });
  elements.joinVoiceButton.addEventListener('click', joinVoiceChannel);
  elements.leaveVoiceButton.addEventListener('click', leaveVoiceChannel);
  

};
