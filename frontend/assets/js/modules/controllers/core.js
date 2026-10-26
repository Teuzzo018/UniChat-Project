// 1. Controller per le funzioni di utilità di base e risoluzione delle entità attive
export const registerCoreController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;

  // 1.1 Restituisce l'oggetto del server attualmente selezionato
  const activeServer = () => state.servers.find((server) => server.id === state.activeServerId);

  // 1.2 Estrae il codice invito da un URL o stringa grezza
  const extractInviteCode = (value = '') => {
    const trimmedValue = value.trim();
  
    if (!trimmedValue) {
      return '';
    }
  
    try {
      const url = new URL(trimmedValue);
      return url.searchParams.get('invite') || trimmedValue;
    } catch {
      return trimmedValue;
    }
  };

  // 1.3 Rimuove il parametro invite dalla barra degli indirizzi del browser senza ricaricare la pagina
  const clearInviteFromUrl = () => {
    if (!new URLSearchParams(window.location.search).has('invite')) {
      return;
    }
  
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // 1.4 Restituisce il canale attualmente attivo nel server selezionato
  const activeChannel = () => {
    const server = activeServer();
    return server?.channels.find((channel) => channel.id === state.activeChannelId);
  };

  // 1.5 Restituisce il contatto/amico con cui è aperta la conversazione privata corrente
  const activePrivateUser = () => {
    return state.friends.map((friendship) => friendship.friend)
      .find((friend) => friend.id === state.activePrivateUserId);
  };

  Object.assign(app, {
    activeServer,
    extractInviteCode,
    clearInviteFromUrl,
    activeChannel,
    activePrivateUser
  });
};

