export const registerServerListsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const selectServer = (...args) => app.selectServer(...args);
  const renderOverviewBar = (...args) => app.renderOverviewBar(...args);

  const renderServers = () => {
    elements.serverList.replaceChildren();
  
    state.servers.forEach((server) => {
      const button = document.createElement('button');
      button.className = `server-dot ${server.id === state.activeServerId ? 'active' : ''}`;
      button.type = 'button';
      button.title = server.name;
      button.textContent = getInitials(server.name);
      button.addEventListener('click', () => selectServer(server.id));
      elements.serverList.append(button);
    });
  };

  const renderAvailableServers = () => {
    elements.availableServerList.replaceChildren();
  
    state.availableServers.forEach((server) => {
      const item = document.createElement('div');
      item.className = 'available-server-item';
  
      const info = document.createElement('div');
  
      const name = document.createElement('strong');
      name.textContent = server.name;
  
      const details = document.createElement('span');
      details.textContent = `${server._count.members} membri`;
  
      const button = document.createElement('button');
      button.className = 'secondary-button';
      button.type = 'button';
      button.textContent = 'Entra';
      button.addEventListener('click', () => joinServer(server.id));
  
      info.append(name, details);
      item.append(info, button);
      elements.availableServerList.append(item);
    });
    renderOverviewBar();
  };

  const renderServerJoinRequests = () => {
    elements.serverJoinRequestList.replaceChildren();

    state.serverJoinRequests.forEach((request) => {
      const item = document.createElement('div');
      item.className = 'request-item';

      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = request.user.fullName;
      const detail = document.createElement('span');
      detail.textContent = `${getDisplayHandle(request.user)} -> ${request.server.name}`;
      info.append(title, detail);

      const actions = document.createElement('div');
      actions.className = 'request-actions';
      const acceptButton = document.createElement('button');
      acceptButton.className = 'secondary-button';
      acceptButton.type = 'button';
      acceptButton.textContent = 'Accetta';
      acceptButton.addEventListener('click', () => answerServerJoinRequest(request.id, true));

      const declineButton = document.createElement('button');
      declineButton.className = 'ghost-button';
      declineButton.type = 'button';
      declineButton.textContent = 'Rifiuta';
      declineButton.addEventListener('click', () => answerServerJoinRequest(request.id, false));

      actions.append(acceptButton, declineButton);
      item.append(createUserAvatar(request.user, 'member-avatar'), info, actions);
      elements.serverJoinRequestList.append(item);
    });
    renderOverviewBar();
  };

  const loadAvailableServers = async () => {
    state.availableServers = await api('/servers/available');
    renderAvailableServers();
  };

  const loadServerJoinRequests = async () => {
    state.serverJoinRequests = await api('/servers/join-requests');
    renderServerJoinRequests();
  };

  const joinServer = async (serverId) => {
    try {
      const result = await api(`/servers/${serverId}/join`, {
        method: 'POST'
      });

      if (result?.id) {
        addOrReplaceServer(result);
        state.availableServers = state.availableServers.filter((availableServer) => availableServer.id !== result.id);
        state.activeServerId = result.id;
        renderAvailableServers();
        renderServers();
        await selectServer(result.id);
        return;
      }

      state.availableServers = state.availableServers.filter((availableServer) => availableServer.id !== serverId);
      renderAvailableServers();
      showToast(result.message || 'Richiesta inviata');
    } catch (error) {
      showToast(error.message);
    }
  };

  const answerServerJoinRequest = async (requestId, accepted) => {
    try {
      if (accepted) {
        const server = await api(`/servers/join-requests/${requestId}/accept`, { method: 'POST' });
        addOrReplaceServer(server);
        renderServers();
        showToast('Richiesta server accettata');
      } else {
        await api(`/servers/join-requests/${requestId}`, { method: 'DELETE' });
        showToast('Richiesta server rifiutata');
      }

      await loadServerJoinRequests();
    } catch (error) {
      showToast(error.message);
    }
  };

  const addOrReplaceServer = (server) => {
    const existingIndex = state.servers.findIndex((item) => item.id === server.id);
  
    if (existingIndex >= 0) {
      state.servers[existingIndex] = server;
      return;
    }
  
    state.servers.push(server);
  };

  Object.assign(app, {
    renderServers,
    renderAvailableServers,
    renderServerJoinRequests,
    loadAvailableServers,
    loadServerJoinRequests,
    joinServer,
    answerServerJoinRequest,
    addOrReplaceServer
  });
};
