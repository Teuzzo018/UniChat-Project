export const registerBootstrapDataController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const setAuthenticatedUi = (...args) => app.setAuthenticatedUi(...args);
  const connectSocket = (...args) => app.connectSocket(...args);
  const loadWorkspaceData = (...args) => app.loadWorkspaceData(...args);

  const loadUniversities = async () => {
    const universities = await api('/universities');
    elements.universitySelect.replaceChildren();
    elements.universitySelect.required = !state.pendingInviteCode && universities.length > 0;
  
    universities.forEach((university) => {
      const option = document.createElement('option');
      option.value = university.id;
      option.textContent = `${university.name} (${university.domain})`;
      elements.universitySelect.append(option);
    });
  
    if (universities.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = state.pendingInviteCode ? 'Nessuna universita, uso un invito' : 'Solo primo admin: nessuna universita';
      elements.universitySelect.append(option);
      return;
    }
  
    const option = document.createElement('option');
    option.value = '';
    option.textContent = state.pendingInviteCode ? 'Nessuna universita, uso un invito' : 'Seleziona universita';
    elements.universitySelect.prepend(option);
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
      if (error.mfaRequired) {
        elements.loginForm.classList.add('hidden');
        elements.registerForm.classList.add('hidden');
        elements.mfaLoginForm.classList.remove('hidden');
        elements.mfaLoginCode.focus();
        return;
      }
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
