export const registerBootstrapDataController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const setAuthenticatedUi = (...args) => app.setAuthenticatedUi(...args);
  const connectSocket = (...args) => app.connectSocket(...args);
  const loadWorkspaceData = (...args) => app.loadWorkspaceData(...args);

  const loadUniversities = async () => {
    const universities = await api('/universities');
    elements.universitySelect.replaceChildren();
    elements.universitySelect.required = !state.pendingInviteCode;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = state.pendingInviteCode ? 'Uso un invito' :
      universities.length ? 'Seleziona università' : 'Nessuna università disponibile';
    elements.universitySelect.append(placeholder);
    universities.forEach((university) => {
      const option = document.createElement('option');
      option.value = university.id;
      option.textContent = `${university.name} (${university.domain})`;
      elements.universitySelect.append(option);
    });
  };

  const bootstrap = async () => {
    await loadUniversities();
  
    if (!state.token) {
      if (state.pendingInviteCode) {
        localStorage.setItem('unichat:pendingInviteCode', state.pendingInviteCode);
        showToast('Accedi per usare il link invito');
      }
      setAuthenticatedUi(false);
      return;
    }
  
    try {
      state.user = await api('/auth/me');
      setAuthenticatedUi(true);
      connectSocket();
      await loadWorkspaceData();
    } catch (error) {
      localStorage.removeItem('unichat:token');
      state.token = null;
      setAuthenticatedUi(false);
    }
  };

  Object.assign(app, {
    loadUniversities,
    bootstrap
  });
};
