/**
 * ============================================================================
 * CONTROLLER IMPOSTAZIONI UTENTE (settings.js)
 * 1. Profilo utente: modifica nome visualizzato e caricamento nuova foto profilo
 * 2. Personalizzazione tema: cambio tema grafico (Chiaro, Scuro, Nero e Rame)
 * 3. Gestione bloccati: consultazione elenco account bloccati con sblocco rapido
 * ============================================================================
 */
export const registerSettingsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const loadFriends = (...args) => app.loadFriends(...args);
  const renderChannels = (...args) => app.renderChannels(...args);
  const activeServer = (...args) => app.activeServer(...args);
  const renderUserDock = (...args) => app.renderUserDock(...args);
  const themeOptions = [...document.querySelectorAll('#settingsDialog input[name="theme"]')];

  themeOptions.forEach((option) => {
    option.addEventListener('change', () => {
      if (!option.checked) return;
      document.documentElement.dataset.theme = option.value;
      try {
        localStorage.setItem('unichat-theme', option.value);
      } catch (_) { /* La scelta resta attiva fino alla chiusura della pagina. */ }
    });
  });

  const renderSettingsLists = () => {
    elements.settingsFriendBlockList.replaceChildren();
    elements.settingsBlockedList.replaceChildren();

    if (!state.friends.length) {
      const empty = document.createElement('p');
      empty.className = 'settings-empty';
      empty.textContent = 'Nessun amico da bloccare.';
      elements.settingsFriendBlockList.append(empty);
    } else {
      state.friends.forEach((friendship) => {
        const friend = friendship.friend;
        const row = document.createElement('div');
        row.className = 'settings-user-row';

        const info = document.createElement('div');
        info.append(createUserAvatar(friend, 'member-avatar'));

        const copy = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = friend.fullName;
        const handle = document.createElement('span');
        handle.textContent = getDisplayHandle(friend);
        copy.append(name, handle);
        info.append(copy);

        const button = document.createElement('button');
        button.className = 'danger-button';
        button.type = 'button';
        button.textContent = 'Blocca';
        button.addEventListener('click', () => blockFriend(friend.id));

        row.append(info, button);
        elements.settingsFriendBlockList.append(row);
      });
    }

    if (!state.blockedUsers.length) {
      const empty = document.createElement('p');
      empty.className = 'settings-empty';
      empty.textContent = 'Nessun utente bloccato.';
      elements.settingsBlockedList.append(empty);
    } else {
      state.blockedUsers.forEach((block) => {
        const user = block.user;
        const row = document.createElement('div');
        row.className = 'settings-user-row';

        const info = document.createElement('div');
        info.append(createUserAvatar(user, 'member-avatar'));

        const copy = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = user.fullName;
        const handle = document.createElement('span');
        handle.textContent = getDisplayHandle(user);
        copy.append(name, handle);
        info.append(copy);

        const button = document.createElement('button');
        button.className = 'secondary-button';
        button.type = 'button';
        button.textContent = 'Sblocca';
        button.addEventListener('click', () => unblockUser(user.id));

        row.append(info, button);
        elements.settingsBlockedList.append(row);
      });
    }
  };

  const loadBlockedUsers = async () => {
    state.blockedUsers = await api('/friends/blocked');
    renderSettingsLists();
  };

  const renderSettingsDialog = () => {
    if (!state.user) {
      return;
    }

    const currentTheme = ['dark', 'copper'].includes(document.documentElement.dataset.theme)
      ? document.documentElement.dataset.theme : 'light';
    themeOptions.forEach((option) => { option.checked = option.value === currentTheme; });

    elements.settingsFullName.value = state.user.fullName || '';
    elements.settingsAvatarFile.value = '';
    elements.settingsPreviewName.textContent = state.user.fullName;
    elements.settingsPreviewHandle.textContent = state.user.role === 'SUPERADMIN' &&
      state.user.email?.toLowerCase() === 'teo.sisto.04@gmail.com'
      ? `${getDisplayHandle(state.user)} · Creator` : getDisplayHandle(state.user);
    renderAvatarContent(elements.settingsAvatarPreview, state.user);
    renderSettingsLists();
  };

  const openUserSettings = async () => {
    if (!state.user) {
      return;
    }

    renderSettingsDialog();
    elements.settingsDialog.showModal();

    try {
      await loadBlockedUsers();
    } catch (error) {
      showToast(error.message);
    }
  };

  const updateProfileSettings = async () => {
    const formData = new FormData();
    formData.append('fullName', elements.settingsFullName.value);

    if (elements.settingsAvatarFile.files[0]) {
      formData.append('file', elements.settingsAvatarFile.files[0]);
    }

    const updatedUser = await api('/auth/me', {
      method: 'PATCH',
      body: formData
    });

    state.user = updatedUser;
    renderUserDock();
    renderSettingsDialog();
    if (!activeServer()) {
      elements.workspaceTitle.textContent = 'Panoramica';
    }
    showToast('Profilo aggiornato');
  };

  const blockFriend = async (userId) => {
    await api(`/friends/${userId}/block`, { method: 'POST' });
    await Promise.all([
      loadFriends(),
      loadBlockedUsers()
    ]);
    renderChannels();
    showToast('Utente bloccato');
  };

  const unblockUser = async (userId) => {
    await api(`/friends/blocked/${userId}`, { method: 'DELETE' });
    await loadBlockedUsers();
    showToast('Utente sbloccato');
  };

  Object.assign(app, {
    renderSettingsLists,
    loadBlockedUsers,
    renderSettingsDialog,
    openUserSettings,
    updateProfileSettings,
    blockFriend,
    unblockUser
  });
};
