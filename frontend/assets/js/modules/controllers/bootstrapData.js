// 1. Controller per il bootstrap e il caricamento iniziale dei dati
export const registerBootstrapDataController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const setAuthenticatedUi = (...args) => app.setAuthenticatedUi(...args);
  const connectSocket = (...args) => app.connectSocket(...args);
  const loadWorkspaceData = (...args) => app.loadWorkspaceData(...args);

  // 1.1 Caricamento dell'elenco delle università dal backend (/api/universities)
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

  // 1.2 Bootstrap dell'applicazione: verifica validità del token e inizializzazione sessione
  const bootstrap = async () => {
    // 1.2.1 Carica l'elenco delle università per il modulo di registrazione
    await loadUniversities();
  
    // 1.2.2 Controllo token: se non è presente un token salvato, mostra la schermata di login
    if (!state.token) {
      if (state.pendingInviteCode) {
        localStorage.setItem('unichat:pendingInviteCode', state.pendingInviteCode);
        showToast('Accedi per usare il link invito');
      }
      setAuthenticatedUi(false);
      return;
    }
  
    // 1.2.3 Se il token esiste, tenta il recupero del profilo utente autenticato (/api/auth/me)
    try {
      state.user = await api('/auth/me');
      // Imposta l'interfaccia utente in modalità autenticata
      setAuthenticatedUi(true);
      // Connette il WebSocket Socket.IO
      connectSocket();
      // Carica tutti i dati dell'area di lavoro (server, canali, amici, preferiti)
      await loadWorkspaceData();
    } catch (error) {
      // 1.2.4 Se il token è scaduto o non valido, ripulisce la memoria e resetta la UI
      localStorage.removeItem('unichat:token');
      state.token = null;
      setAuthenticatedUi(false);
    }
  };

  // 1.3 Registrazione dei metodi nel contesto dell'applicazione
  Object.assign(app, {
    loadUniversities,
    bootstrap
  });
};

