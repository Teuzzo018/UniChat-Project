const state = {
  token: localStorage.getItem('unichat:token'),
  pendingInviteCode: new URLSearchParams(window.location.search).get('invite') || localStorage.getItem('unichat:pendingInviteCode'),
  user: null,
  servers: [],
  availableServers: [],
  activeServerId: null,
  activeChannelId: null,
  activePrivateUserId: null,
  game: null,
  socket: null
};

const elements = {
  acceptGameButton: document.querySelector('#acceptGameButton'),
  adminButton: document.querySelector('#adminButton'),
  adminMessages: document.querySelector('#adminMessages'),
  adminPanel: document.querySelector('#adminPanel'),
  adminServers: document.querySelector('#adminServers'),
  adminUsers: document.querySelector('#adminUsers'),
  authPanel: document.querySelector('#authPanel'),
  availableServerList: document.querySelector('#availableServerList'),
  channelForm: document.querySelector('#channelForm'),
  channelList: document.querySelector('#channelList'),
  channelTitle: document.querySelector('#channelTitle'),
  channelType: document.querySelector('#channelType'),
  closeGameButton: document.querySelector('#closeGameButton'),
  connectionStatus: document.querySelector('#connectionStatus'),
  copyInviteButton: document.querySelector('#copyInviteButton'),
  createServerFromSidebar: document.querySelector('#createServerFromSidebar'),
  createUniversityButton: document.querySelector('#createUniversityButton'),
  declineGameButton: document.querySelector('#declineGameButton'),
  deleteServerButton: document.querySelector('#deleteServerButton'),
  emptyState: document.querySelector('#emptyState'),
  gameBoard: document.querySelector('#gameBoard'),
  gamePanel: document.querySelector('#gamePanel'),
  gameStatus: document.querySelector('#gameStatus'),
  gameTitle: document.querySelector('#gameTitle'),
  homeButton: document.querySelector('#homeButton'),
  inviteCodeInput: document.querySelector('#inviteCodeInput'),
  inviteForm: document.querySelector('#inviteForm'),
  loginForm: document.querySelector('#loginForm'),
  logoutButton: document.querySelector('#logoutButton'),
  memberList: document.querySelector('#memberList'),
  messageForm: document.querySelector('#messageForm'),
  messageInput: document.querySelector('#messageInput'),
  messages: document.querySelector('#messages'),
  newServerButton: document.querySelector('#newServerButton'),
  registerForm: document.querySelector('#registerForm'),
  restartGameButton: document.querySelector('#restartGameButton'),
  serverDialog: document.querySelector('#serverDialog'),
  serverForm: document.querySelector('#serverForm'),
  serverList: document.querySelector('#serverList'),
  splashScreen: document.querySelector('#splashScreen'),
  toast: document.querySelector('#toast'),
  universityDomain: document.querySelector('#universityDomain'),
  universityName: document.querySelector('#universityName'),
  universitySelect: document.querySelector('#universitySelect'),
  workspacePanel: document.querySelector('#workspacePanel'),
  workspaceTitle: document.querySelector('#workspaceTitle')
};

window.setTimeout(() => {
  elements.splashScreen?.classList.add('hidden');
}, 900);

window.setTimeout(() => {
  elements.splashScreen?.remove();
}, 1700);

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Richiesta non riuscita');
  }

  return payload;
};

const showToast = (message) => {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  window.setTimeout(() => elements.toast.classList.remove('visible'), 2600);
};

const getInitials = (name = '?') => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const createUserAvatar = (user, className = 'avatar') => {
  const avatar = document.createElement('div');
  avatar.className = className;

  if (user?.avatarUrl) {
    const image = document.createElement('img');
    image.src = user.avatarUrl;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      avatar.replaceChildren();
      avatar.textContent = getInitials(user.fullName);
    }, { once: true });
    avatar.append(image);
    return avatar;
  }

  avatar.textContent = getInitials(user?.fullName);
  return avatar;
};

const activeServer = () => state.servers.find((server) => server.id === state.activeServerId);

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

const clearInviteFromUrl = () => {
  if (!new URLSearchParams(window.location.search).has('invite')) {
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname);
};

const activeChannel = () => {
  const server = activeServer();
  return server?.channels.find((channel) => channel.id === state.activeChannelId);
};

const activePrivateUser = () => {
  const server = activeServer();
  const members = server?.members.map((membership) => membership.user) || [];
  return members.find((member) => member.id === state.activePrivateUserId);
};

const setDefaultEmptyState = () => {
  elements.emptyState.querySelector('h2').textContent = 'Chat universitaria senza distrazioni';
  elements.emptyState.querySelector('p').textContent = 'Server per corsi, canali testuali e vocali, messaggi in tempo reale e accesso tramite account.';
};

const setAuthenticatedUi = (authenticated) => {
  elements.authPanel.classList.toggle('hidden', authenticated);
  elements.workspacePanel.classList.toggle('hidden', !authenticated);
  elements.logoutButton.classList.toggle('hidden', !authenticated);
  elements.adminButton.classList.toggle('hidden', !authenticated || state.user?.role !== 'ADMIN');
  elements.workspaceTitle.textContent = authenticated ? state.user.fullName : 'Accesso';
};

const createAdminRow = ({ title, detail, actionLabel, onAction }) => {
  const item = document.createElement('div');
  item.className = 'admin-item';

  const info = document.createElement('div');

  const titleElement = document.createElement('strong');
  titleElement.textContent = title;

  const detailElement = document.createElement('span');
  detailElement.textContent = detail;

  const button = document.createElement('button');
  button.className = 'danger-button';
  button.type = 'button';
  button.textContent = actionLabel;
  button.addEventListener('click', onAction);

  info.append(titleElement, detailElement);
  item.append(info, button);

  return item;
};

const deleteAdminResource = async ({ path, confirmMessage }) => {
  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    await api(path, { method: 'DELETE' });
    await loadAdminPanel();
    state.servers = await api('/servers');

    if (state.activeServerId && !state.servers.some((server) => server.id === state.activeServerId)) {
      state.activeServerId = state.servers[0]?.id || null;
    }

    renderServers();
    renderChannels();
    await loadAvailableServers();
    showToast('Elemento eliminato');
  } catch (error) {
    showToast(error.message);
  }
};

const renderAdminPanel = (overview) => {
  elements.adminUsers.replaceChildren();
  elements.adminServers.replaceChildren();
  elements.adminMessages.replaceChildren();

  overview.users.forEach((user) => {
    elements.adminUsers.append(createAdminRow({
      title: `${user.fullName} (${user.role})`,
      detail: `${user.email} - ${user.university?.name || 'nessuna universita'}`,
      actionLabel: 'Elimina',
      onAction: () => deleteAdminResource({
        path: `/admin/users/${user.id}`,
        confirmMessage: `Eliminare l'utente ${user.fullName}?`
      })
    }));
  });

  overview.servers.forEach((server) => {
    elements.adminServers.append(createAdminRow({
      title: server.name,
      detail: `${server.university.name} - ${server._count.members} membri - owner ${server.owner.fullName}`,
      actionLabel: 'Elimina',
      onAction: () => deleteAdminResource({
        path: `/admin/servers/${server.id}`,
        confirmMessage: `Eliminare il server ${server.name} e i suoi messaggi?`
      })
    }));
  });

  overview.messages.forEach((message) => {
    elements.adminMessages.append(createAdminRow({
      title: `${message.user.fullName} in ${message.channel.server.name} / ${message.channel.name}`,
      detail: message.content,
      actionLabel: 'Elimina',
      onAction: () => deleteAdminResource({
        path: `/admin/messages/${message.id}`,
        confirmMessage: 'Eliminare questo messaggio?'
      })
    }));
  });
};

const loadAdminPanel = async () => {
  const overview = await api('/admin/overview');
  renderAdminPanel(overview);
};

const showAdminPanel = async () => {
  if (state.user?.role !== 'ADMIN') {
    return;
  }

  state.activeChannelId = null;
  state.activePrivateUserId = null;
  state.game = null;
  elements.emptyState.classList.add('hidden');
  elements.gamePanel.classList.add('hidden');
  elements.messages.classList.add('hidden');
  elements.messageForm.classList.add('hidden');
  elements.adminPanel.classList.remove('hidden');
  elements.channelTitle.textContent = 'Pannello admin';
  elements.channelType.textContent = 'Amministrazione';
  renderChannels();

  try {
    await loadAdminPanel();
  } catch (error) {
    showToast(error.message);
  }
};

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
};

const renderChannels = () => {
  const server = activeServer();
  elements.channelList.replaceChildren();
  elements.memberList.replaceChildren();
  elements.copyInviteButton.disabled = !server;
  elements.deleteServerButton.classList.toggle('hidden', !server);

  if (!server) {
    elements.workspaceTitle.textContent = state.user?.fullName || 'Accesso';
    return;
  }

  elements.workspaceTitle.textContent = server.name;
  elements.deleteServerButton.textContent = server.ownerId === state.user.id ? 'Elimina server' : 'Lascia server';

  server.channels.forEach((channel) => {
    const button = document.createElement('button');
    button.className = `channel-item ${channel.id === state.activeChannelId ? 'active' : ''}`;
    button.type = 'button';
    button.textContent = `${channel.type === 'TEXT' ? '#' : '>'} ${channel.name}`;
    button.addEventListener('click', () => selectChannel(channel.id));
    elements.channelList.append(button);
  });

  server.members
    .map((membership) => membership.user)
    .filter((member) => member.id !== state.user.id)
    .forEach((member) => {
      const button = document.createElement('button');
      button.className = `member-item ${member.id === state.activePrivateUserId ? 'active' : ''}`;
      button.type = 'button';
      const avatar = createUserAvatar(member, 'member-avatar');
      const name = document.createElement('span');
      name.textContent = member.fullName;
      button.append(avatar, name);
      button.addEventListener('click', () => startPrivateGame(member.id));
      elements.memberList.append(button);
    });
};

const getCurrentPlayer = () => {
  return state.game?.players.find((player) => player.id === state.user.id);
};

const getOpponent = () => {
  return state.game?.players.find((player) => player.id !== state.user.id);
};

const setGameStatus = () => {
  if (!state.game) {
    elements.gameStatus.textContent = 'Scegli un utente dal server.';
    return;
  }

  const player = getCurrentPlayer();
  const opponent = getOpponent();

  elements.gameTitle.textContent = `Tris con ${opponent?.fullName || 'utente'}`;

  if (state.game.status === 'pending') {
    const invited = state.game.players[1]?.id === state.user.id;
    elements.gameStatus.textContent = invited ? 'Invito ricevuto.' : 'Invito inviato.';
    return;
  }

  if (state.game.status === 'declined') {
    elements.gameStatus.textContent = 'Invito rifiutato.';
    return;
  }

  if (state.game.winner === 'draw') {
    elements.gameStatus.textContent = 'Pareggio.';
    return;
  }

  if (state.game.winner) {
    elements.gameStatus.textContent = state.game.winner === player?.symbol ? 'Hai vinto.' : 'Hai perso.';
    return;
  }

  elements.gameStatus.textContent = state.game.turn === player?.symbol ? 'Tocca a te.' : `Turno di ${opponent?.fullName || 'avversario'}.`;
};

const renderGame = () => {
  elements.emptyState.classList.add('hidden');
  elements.adminPanel.classList.add('hidden');
  elements.messages.classList.add('hidden');
  elements.messageForm.classList.add('hidden');
  elements.gamePanel.classList.remove('hidden');
  elements.gameBoard.replaceChildren();

  const player = getCurrentPlayer();
  const canMove = state.game?.status === 'active' && state.game.turn === player?.symbol && !state.game.winner;
  const invited = state.game?.status === 'pending' && state.game.players[1]?.id === state.user.id;

  elements.acceptGameButton.classList.toggle('hidden', !invited);
  elements.declineGameButton.classList.toggle('hidden', !invited);
  elements.restartGameButton.classList.toggle('hidden', state.game?.status !== 'finished');

  for (let index = 0; index < 9; index += 1) {
    const cell = document.createElement('button');
    cell.className = `game-cell ${state.game?.winningLine.includes(index) ? 'win' : ''}`;
    cell.type = 'button';
    cell.textContent = state.game?.board[index] || '';
    cell.disabled = !canMove || Boolean(state.game?.board[index]);
    cell.addEventListener('click', () => playGameMove(index));
    elements.gameBoard.append(cell);
  }

  setGameStatus();
};

const showGame = (game) => {
  state.game = game;
  state.activePrivateUserId = getOpponent()?.id || state.activePrivateUserId;
  state.activeChannelId = null;
  renderChannels();
  renderGame();
};

const closeGame = () => {
  state.activePrivateUserId = null;
  state.game = null;
  elements.gamePanel.classList.add('hidden');
  renderChannels();
  loadMessages();
};

const renderMessage = (message) => {
  const article = document.createElement('article');
  article.className = 'message';
  article.dataset.messageId = message.id;

  const avatar = createUserAvatar(message.user);

  const body = document.createElement('div');
  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const author = document.createElement('span');
  author.className = 'message-author';
  author.textContent = message.user.fullName;

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(message.createdAt));

  const content = document.createElement('p');
  content.className = 'message-content';
  content.textContent = message.content;

  meta.append(author, time);
  body.append(meta, content);
  article.append(avatar, body);
  elements.messages.append(article);
};

const loadMessages = async () => {
  const channel = activeChannel();

  elements.adminPanel.classList.add('hidden');
  elements.gamePanel.classList.add('hidden');
  elements.messages.replaceChildren();
  elements.emptyState.classList.toggle('hidden', Boolean(channel));
  elements.messages.classList.toggle('hidden', !channel);
  elements.messageForm.classList.toggle('hidden', !channel || channel.type !== 'TEXT');

  if (!channel) {
    setDefaultEmptyState();
    elements.channelTitle.textContent = 'Benvenuto in UniChat';
    elements.channelType.textContent = 'Canale';
    return;
  }

  elements.channelTitle.textContent = channel.name;
  elements.channelType.textContent = channel.type === 'TEXT' ? 'Canale testuale' : 'Canale vocale';

  if (channel.type !== 'TEXT') {
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.querySelector('h2').textContent = 'Canale vocale';
    elements.emptyState.querySelector('p').textContent = 'Spazio pronto per coordinarsi, senza notifiche.';
    return;
  }

  const messages = await api(`/channels/${channel.id}/messages`);
  messages.forEach(renderMessage);
  elements.messages.scrollTop = elements.messages.scrollHeight;
};

const selectChannel = async (channelId) => {
  state.activeChannelId = channelId;
  state.activePrivateUserId = null;
  state.socket?.emit('join_channel', channelId);
  renderChannels();
  await loadMessages();
};

const selectServer = async (serverId) => {
  state.activeServerId = serverId;
  state.activePrivateUserId = null;
  state.game = null;
  const server = activeServer();
  state.activeChannelId = server?.channels.find((channel) => channel.type === 'TEXT')?.id || server?.channels[0]?.id || null;
  renderServers();
  renderChannels();

  if (state.activeChannelId) {
    state.socket?.emit('join_channel', state.activeChannelId);
  }

  await loadMessages();
};

const loadAvailableServers = async () => {
  state.availableServers = await api('/servers/available');
  renderAvailableServers();
};

const loadServers = async () => {
  state.servers = await api('/servers');

  if (!state.activeServerId || !state.servers.some((server) => server.id === state.activeServerId)) {
    state.activeServerId = state.servers[0]?.id || null;
  }

  renderServers();
  await selectServer(state.activeServerId);
  await loadAvailableServers();

  if (state.pendingInviteCode) {
    await joinServerByInvite(state.pendingInviteCode);
  }
};

const joinServer = async (serverId) => {
  try {
    const server = await api(`/servers/${serverId}/join`, {
      method: 'POST'
    });

    state.servers.push(server);
    state.availableServers = state.availableServers.filter((availableServer) => availableServer.id !== server.id);
    state.activeServerId = server.id;
    renderAvailableServers();
    renderServers();
    await selectServer(server.id);
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

const joinServerByInvite = async (rawInviteCode) => {
  const inviteCode = extractInviteCode(rawInviteCode);

  if (!inviteCode) {
    showToast('Inserisci un codice invito');
    return;
  }

  try {
    const server = await api('/servers/join-by-invite', {
      method: 'POST',
      body: JSON.stringify({ inviteCode })
    });

    addOrReplaceServer(server);
    state.availableServers = state.availableServers.filter((availableServer) => availableServer.id !== server.id);
    state.activeServerId = server.id;
    state.pendingInviteCode = null;
    localStorage.removeItem('unichat:pendingInviteCode');
    clearInviteFromUrl();
    elements.inviteCodeInput.value = '';
    renderAvailableServers();
    renderServers();
    await selectServer(server.id);
    showToast('Sei entrato nel server tramite invito');
  } catch (error) {
    showToast(error.message);
  }
};

const copyActiveServerInvite = async () => {
  const server = activeServer();

  if (!server?.inviteCode) {
    showToast('Seleziona prima un server');
    return;
  }

  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${server.inviteCode}`;

  try {
    await navigator.clipboard.writeText(inviteUrl);
    showToast('Link invito copiato');
  } catch {
    elements.inviteCodeInput.value = inviteUrl;
    showToast('Link inserito nel campo invito');
  }
};

const deleteOrLeaveActiveServer = async () => {
  const server = activeServer();

  if (!server) {
    showToast('Seleziona prima un server');
    return;
  }

  const isOwner = server.ownerId === state.user.id;
  const confirmed = window.confirm(
    isOwner
      ? `Eliminare il server ${server.name}? Questa azione rimuove anche canali e messaggi.`
      : `Lasciare il server ${server.name}?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const result = await api(`/servers/${server.id}`, { method: 'DELETE' });
    state.servers = state.servers.filter((item) => item.id !== server.id);
    state.activeServerId = state.servers[0]?.id || null;
    state.activeChannelId = null;
    state.activePrivateUserId = null;
    state.game = null;
    renderServers();
    renderChannels();
    await selectServer(state.activeServerId);
    await loadAvailableServers();
    showToast(result.message || (isOwner ? 'Server eliminato' : 'Sei uscito dal server'));
  } catch (error) {
    showToast(error.message);
  }
};

const connectSocket = () => {
  if (state.socket) {
    state.socket.disconnect();
  }

  state.socket = io();

  state.socket.on('connect', () => {
    elements.connectionStatus.textContent = 'online';
    elements.connectionStatus.classList.add('online');

    if (state.activeChannelId) {
      state.socket.emit('join_channel', state.activeChannelId);
    }

    state.socket.emit('authenticate', { token: state.token });
  });

  state.socket.on('disconnect', () => {
    elements.connectionStatus.textContent = 'offline';
    elements.connectionStatus.classList.remove('online');
  });

  state.socket.on('message_created', (message) => {
    if (message.channelId !== state.activeChannelId) {
      return;
    }

    if (elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
      return;
    }

    renderMessage(message);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  });

  state.socket.on('private_game_invite', (game) => {
    showGame(game);
    showToast(`Invito a Tris da ${game.players[0].fullName}`);
  });

  state.socket.on('private_game_update', (game) => {
    showGame(game);
  });
};

const startPrivateGame = (opponentId) => {
  const server = activeServer();

  if (!server || !state.socket?.connected) {
    showToast('Connessione non disponibile');
    return;
  }

  state.activePrivateUserId = opponentId;
  state.socket.emit('private_game_request', {
    token: state.token,
    opponentId,
    serverId: server.id
  }, (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Partita non avviata');
      return;
    }

    showGame(response.game);
  });
};

const answerGameInvite = (accepted) => {
  if (!state.game) {
    return;
  }

  state.socket.emit('private_game_accept', {
    token: state.token,
    gameId: state.game.id,
    accepted
  }, (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Risposta non inviata');
      return;
    }

    showGame(response.game);
  });
};

const playGameMove = (index) => {
  if (!state.game) {
    return;
  }

  state.socket.emit('private_game_move', {
    token: state.token,
    gameId: state.game.id,
    index
  }, (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Mossa non valida');
    }
  });
};

const restartGame = () => {
  if (!state.game) {
    return;
  }

  state.socket.emit('private_game_restart', {
    token: state.token,
    gameId: state.game.id
  }, (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Partita non riavviata');
    }
  });
};

const loadUniversities = async () => {
  const universities = await api('/universities');
  elements.universitySelect.replaceChildren();
  elements.universitySelect.required = !state.pendingInviteCode;

  universities.forEach((university) => {
    const option = document.createElement('option');
    option.value = university.id;
    option.textContent = `${university.name} (${university.domain})`;
    elements.universitySelect.append(option);
  });

  if (universities.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = state.pendingInviteCode ? 'Nessuna universita, uso un invito' : 'Aggiungi prima una universita';
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
    await loadServers();
  } catch (error) {
    localStorage.removeItem('unichat:token');
    state.token = null;
    setAuthenticatedUi(false);
  }
};

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
    await loadServers();
  } catch (error) {
    showToast(error.message);
  }
});

elements.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const payload = Object.fromEntries(form);

    if (state.pendingInviteCode) {
      payload.inviteCode = state.pendingInviteCode;
    }

    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
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
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
  }

  state.token = null;
  state.user = null;
  state.servers = [];
  state.availableServers = [];
  state.activeServerId = null;
  state.activeChannelId = null;
  state.activePrivateUserId = null;
  state.game = null;
  state.socket?.disconnect();
  localStorage.removeItem('unichat:token');
  setAuthenticatedUi(false);
  renderServers();
  renderChannels();
  elements.gamePanel.classList.add('hidden');
  elements.adminPanel.classList.add('hidden');
  await loadMessages();
});

const openServerDialog = () => elements.serverDialog.showModal();

elements.adminButton.addEventListener('click', showAdminPanel);
elements.newServerButton.addEventListener('click', openServerDialog);
elements.createServerFromSidebar.addEventListener('click', openServerDialog);
elements.copyInviteButton.addEventListener('click', copyActiveServerInvite);
elements.deleteServerButton.addEventListener('click', deleteOrLeaveActiveServer);
document.querySelector('#closeServerDialog').addEventListener('click', () => elements.serverDialog.close());

elements.inviteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await joinServerByInvite(elements.inviteCodeInput.value);
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
  const content = elements.messageInput.value;

  if (!content.trim() || !state.activeChannelId) {
    return;
  }

  state.socket.emit('send_message', {
    token: state.token,
    channelId: state.activeChannelId,
    content
  }, (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Messaggio non inviato');
    }
  });

  elements.messageInput.value = '';
});

elements.homeButton.addEventListener('click', () => {
  state.activeServerId = state.servers[0]?.id || null;
  selectServer(state.activeServerId);
});

elements.acceptGameButton.addEventListener('click', () => answerGameInvite(true));
elements.declineGameButton.addEventListener('click', () => answerGameInvite(false));
elements.restartGameButton.addEventListener('click', restartGame);
elements.closeGameButton.addEventListener('click', closeGame);

bootstrap().catch((error) => showToast(error.message));
