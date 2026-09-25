const state = {
  token: localStorage.getItem('unichat:token'),
  pendingInviteCode: new URLSearchParams(window.location.search).get('invite') || localStorage.getItem('unichat:pendingInviteCode'),
  pendingGameId: new URLSearchParams(window.location.search).get('game'),
  user: null,
  servers: [],
  availableServers: [],
  activeServerId: null,
  activeChannelId: null,
  activePrivateUserId: null,
  activeConversationType: 'channel',
  friends: [],
  friendRequests: [],
  friendsExpanded: false,
  friendSearchResults: [],
  serverJoinRequests: [],
  blockedUsers: [],
  activeOverviewPanel: null,
  game: null,
  selectedGameType: 'TICTACTOE',
  userDock: {
    muted: false,
    deafened: false
  },
  socket: null,
  voice: {
    channelId: null,
    localStream: null,
    peers: new Map(),
    participants: [],
    recognition: null,
    shouldTranscribe: false,
    transcriptInterim: '',
    transcripts: []
  },
  call: {
    id: null,
    peer: null,
    friend: null,
    localStream: null,
    pendingIceCandidates: [],
    incoming: false,
    active: false
  }
};

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'avif',
  'aac',
  'doc',
  'docx',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'm4a',
  'm4v',
  'mov',
  'mp3',
  'mp4',
  'ogg',
  'pdf',
  'png',
  'ppt',
  'pptx',
  'txt',
  'wav',
  'webp',
  'xls',
  'xlsx',
  'zip'
]);

const elements = {
  acceptGameButton: document.querySelector('#acceptGameButton'),
  acceptCallButton: document.querySelector('#acceptCallButton'),
  adminButton: document.querySelector('#adminButton'),
  adminMessages: document.querySelector('#adminMessages'),
  adminPanel: document.querySelector('#adminPanel'),
  adminServers: document.querySelector('#adminServers'),
  adminUsers: document.querySelector('#adminUsers'),
  authPanel: document.querySelector('#authPanel'),
  availableServerList: document.querySelector('#availableServerList'),
  availableServersBadge: document.querySelector('#availableServersBadge'),
  channelForm: document.querySelector('#channelForm'),
  channelList: document.querySelector('#channelList'),
  channelsBadge: document.querySelector('#channelsBadge'),
  channelTitle: document.querySelector('#channelTitle'),
  channelType: document.querySelector('#channelType'),
  callPanel: document.querySelector('#callPanel'),
  callHistory: document.querySelector('#callHistory'),
  callHistoryList: document.querySelector('#callHistoryList'),
  callStatus: document.querySelector('#callStatus'),
  callTitle: document.querySelector('#callTitle'),
  closeGameButton: document.querySelector('#closeGameButton'),
  connectionStatus: document.querySelector('#connectionStatus'),
  contentArea: document.querySelector('#contentArea'),
  confirmAcceptButton: document.querySelector('#confirmAcceptButton'),
  confirmCancelButton: document.querySelector('#confirmCancelButton'),
  confirmDialog: document.querySelector('#confirmDialog'),
  confirmDialogMessage: document.querySelector('#confirmDialogMessage'),
  copyInviteButton: document.querySelector('#copyInviteButton'),
  createServerFromSidebar: document.querySelector('#createServerFromSidebar'),
  createUniversityButton: document.querySelector('#createUniversityButton'),
  declineGameButton: document.querySelector('#declineGameButton'),
  declineCallButton: document.querySelector('#declineCallButton'),
  deleteServerButton: document.querySelector('#deleteServerButton'),
  deafenButton: document.querySelector('#deafenButton'),
  emptyState: document.querySelector('#emptyState'),
  endCallButton: document.querySelector('#endCallButton'),
  gameBoard: document.querySelector('#gameBoard'),
  gameDialog: document.querySelector('#gameDialog'),
  gameFriendList: document.querySelector('#gameFriendList'),
  gamePanel: document.querySelector('#gamePanel'),
  gameRailButton: document.querySelector('#gameRailButton'),
  gameStatus: document.querySelector('#gameStatus'),
  gameTitle: document.querySelector('#gameTitle'),
  gameTypeButtons: document.querySelectorAll('[data-game-type]'),
  friendRequestsBadge: document.querySelector('#friendRequestsBadge'),
  friendForm: document.querySelector('#friendForm'),
  friendCounterButton: document.querySelector('#friendCounterButton'),
  friendCount: document.querySelector('#friendCount'),
  friendList: document.querySelector('#friendList'),
  friendSearchBadge: document.querySelector('#friendSearchBadge'),
  friendRequestList: document.querySelector('#friendRequestList'),
  friendSearchList: document.querySelector('#friendSearchList'),
  friendUsernameInput: document.querySelector('#friendUsernameInput'),
  homeButton: document.querySelector('#homeButton'),
  inviteCodeInput: document.querySelector('#inviteCodeInput'),
  inviteForm: document.querySelector('#inviteForm'),
  joinVoiceButton: document.querySelector('#joinVoiceButton'),
  leaveVoiceButton: document.querySelector('#leaveVoiceButton'),
  loginForm: document.querySelector('#loginForm'),
  logoutButton: document.querySelector('#logoutButton'),
  memberList: document.querySelector('#memberList'),
  messageForm: document.querySelector('#messageForm'),
  messageFileInput: document.querySelector('#messageFileInput'),
  messageAttachmentPreview: document.querySelector('#messageAttachmentPreview'),
  messageInput: document.querySelector('#messageInput'),
  messages: document.querySelector('#messages'),
  muteButton: document.querySelector('#muteButton'),
  newServerButton: document.querySelector('#newServerButton'),
  overviewBar: document.querySelector('#overviewBar'),
  overviewPanel: document.querySelector('#overviewPanel'),
  overviewSections: document.querySelectorAll('[data-overview-content]'),
  overviewTabs: document.querySelectorAll('[data-overview-panel]'),
  permissionsButton: document.querySelector('#permissionsButton'),
  profileAvatar: document.querySelector('#profileAvatar'),
  profileButton: document.querySelector('#profileButton'),
  profileHandle: document.querySelector('#profileHandle'),
  profileName: document.querySelector('#profileName'),
  registerForm: document.querySelector('#registerForm'),
  restartGameButton: document.querySelector('#restartGameButton'),
  sendGameLinkButton: document.querySelector('#sendGameLinkButton'),
  localVideo: document.querySelector('#localVideo'),
  remoteVideo: document.querySelector('#remoteVideo'),
  serverDialog: document.querySelector('#serverDialog'),
  serverForm: document.querySelector('#serverForm'),
  serverJoinRequestList: document.querySelector('#serverJoinRequestList'),
  serverRequestsBadge: document.querySelector('#serverRequestsBadge'),
  serverList: document.querySelector('#serverList'),
  settingsButton: document.querySelector('#settingsButton'),
  settingsAvatarPreview: document.querySelector('#settingsAvatarPreview'),
  settingsAvatarFile: document.querySelector('#settingsAvatarFile'),
  settingsBlockedList: document.querySelector('#settingsBlockedList'),
  settingsDialog: document.querySelector('#settingsDialog'),
  settingsFriendBlockList: document.querySelector('#settingsFriendBlockList'),
  settingsFullName: document.querySelector('#settingsFullName'),
  settingsPreviewHandle: document.querySelector('#settingsPreviewHandle'),
  settingsPreviewName: document.querySelector('#settingsPreviewName'),
  settingsProfileForm: document.querySelector('#settingsProfileForm'),
  splashScreen: document.querySelector('#splashScreen'),
  toast: document.querySelector('#toast'),
  universityDomain: document.querySelector('#universityDomain'),
  universityName: document.querySelector('#universityName'),
  universitySelect: document.querySelector('#universitySelect'),
  videoCallButton: document.querySelector('#videoCallButton'),
  userDock: document.querySelector('#userDock'),
  remoteAudio: document.querySelector('#remoteAudio'),
  voicePanel: document.querySelector('#voicePanel'),
  voiceParticipants: document.querySelector('#voiceParticipants'),
  voiceStatus: document.querySelector('#voiceStatus'),
  voiceTitle: document.querySelector('#voiceTitle'),
  voiceTranscriptInterim: document.querySelector('#voiceTranscriptInterim'),
  voiceTranscriptList: document.querySelector('#voiceTranscriptList'),
  voiceTranscriptStatus: document.querySelector('#voiceTranscriptStatus'),
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
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

const showConfirm = (message, confirmLabel = 'Conferma') => new Promise((resolve) => {
  elements.confirmDialogMessage.textContent = message;
  elements.confirmAcceptButton.textContent = confirmLabel;

  const finish = (confirmed) => {
    elements.confirmAcceptButton.removeEventListener('click', onAccept);
    elements.confirmCancelButton.removeEventListener('click', onCancel);
    elements.confirmDialog.removeEventListener('cancel', onDialogCancel);
    elements.confirmDialog.close();
    resolve(confirmed);
  };

  const onAccept = () => finish(true);
  const onCancel = () => finish(false);
  const onDialogCancel = (event) => {
    event.preventDefault();
    finish(false);
  };

  elements.confirmAcceptButton.addEventListener('click', onAccept);
  elements.confirmCancelButton.addEventListener('click', onCancel);
  elements.confirmDialog.addEventListener('cancel', onDialogCancel);
  elements.confirmDialog.showModal();
});

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

const renderAvatarContent = (container, user) => {
  container.replaceChildren();

  if (user?.avatarUrl) {
    const image = document.createElement('img');
    image.src = user.avatarUrl;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      container.replaceChildren();
      container.textContent = getInitials(user.fullName);
    }, { once: true });
    container.append(image);
    return;
  }

  container.textContent = getInitials(user?.fullName);
};

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

const setBadgeCount = (badge, count) => {
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count <= 0);
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

  elements.settingsFullName.value = state.user.fullName || '';
  elements.settingsAvatarFile.value = '';
  elements.settingsPreviewName.textContent = state.user.fullName;
  elements.settingsPreviewHandle.textContent = getDisplayHandle(state.user);
  renderAvatarContent(elements.settingsAvatarPreview, state.user);
  renderSettingsLists();
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
  return members.find((member) => member.id === state.activePrivateUserId)
    || state.friends.map((friendship) => friendship.friend).find((friend) => friend.id === state.activePrivateUserId)
    || state.friendSearchResults.find((user) => user.id === state.activePrivateUserId);
};

const getDisplayHandle = (user) => user?.username ? `@${user.username}` : user?.email || '';

const appendMessageContent = (container, text = '') => {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;

  text.replace(urlPattern, (url, _match, index) => {
    container.append(document.createTextNode(text.slice(lastIndex, index)));

    const link = document.createElement('a');
    link.href = url;
    link.textContent = url;
    link.target = '_blank';
    link.rel = 'noopener';
    container.append(link);

    lastIndex = index + url.length;
    return url;
  });

  container.append(document.createTextNode(text.slice(lastIndex)));
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
  if (!await showConfirm(confirmMessage, 'Elimina')) {
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
  state.activeConversationType = 'channel';
  state.game = null;
  elements.emptyState.classList.add('hidden');
  elements.gamePanel.classList.add('hidden');
  elements.callPanel.classList.add('hidden');
  elements.voicePanel.classList.add('hidden');
  elements.callHistory.classList.add('hidden');
  elements.messages.classList.add('hidden');
  elements.messageForm.classList.add('hidden');
  elements.videoCallButton.classList.add('hidden');
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

const renderFriendRow = ({ user, isFriend, friendshipStatus, requestedByMe }) => {
  const item = document.createElement('div');
  item.className = 'friend-item';

  const avatar = createUserAvatar(user, 'member-avatar');
  const info = document.createElement('div');

  const name = document.createElement('strong');
  name.textContent = user.fullName;

  const handle = document.createElement('span');
  handle.textContent = getDisplayHandle(user);

  const actions = document.createElement('div');
  actions.className = 'friend-actions';

  const chatButton = document.createElement('button');
  chatButton.className = 'secondary-button';
  chatButton.type = 'button';
  chatButton.textContent = 'Chat';
  chatButton.addEventListener('click', () => selectPrivateChat(user));

  const historyButton = document.createElement('button');
  historyButton.className = 'secondary-button';
  historyButton.type = 'button';
  historyButton.textContent = 'Storico';
  historyButton.addEventListener('click', () => showCallHistoryForUser(user));

  const button = document.createElement('button');
  button.className = isFriend ? 'ghost-button' : 'secondary-button';
  button.type = 'button';
  button.disabled = friendshipStatus === 'PENDING';
  button.textContent = isFriend ? 'Rimuovi' : friendshipStatus === 'PENDING'
    ? (requestedByMe ? 'Inviata' : 'Da accettare')
    : 'Aggiungi';
  button.addEventListener('click', () => (isFriend ? removeFriend(user.id) : addFriend(user.username)));

  info.append(name, handle);
  if (isFriend) {
    actions.append(chatButton, historyButton, button);
  } else {
    actions.append(button);
  }
  item.append(avatar, info, actions);
  return item;
};

const renderFriends = () => {
  elements.friendList.replaceChildren();
  elements.friendRequestList.replaceChildren();
  elements.friendSearchList.replaceChildren();
  elements.friendCount.textContent = String(state.friends.length);
  elements.friendCounterButton.classList.toggle('active', state.friendsExpanded);
  elements.friendList.classList.toggle('hidden', !state.friendsExpanded);

  state.friends.forEach((friendship) => {
    elements.friendList.append(renderFriendRow({
      user: friendship.friend,
      isFriend: true
    }));
  });

  state.friendRequests.forEach((request) => {
    const item = document.createElement('div');
    item.className = 'friend-item request-item';
    item.append(createUserAvatar(request.friend, 'member-avatar'));

    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = request.friend.fullName;
    const handle = document.createElement('span');
    handle.textContent = getDisplayHandle(request.friend);
    info.append(name, handle);

    const actions = document.createElement('div');
    actions.className = 'friend-actions';

    if (request.incoming) {
      const acceptButton = document.createElement('button');
      acceptButton.className = 'secondary-button';
      acceptButton.type = 'button';
      acceptButton.textContent = 'Accetta';
      acceptButton.addEventListener('click', () => answerFriendRequest(request.id, true));

      const declineButton = document.createElement('button');
      declineButton.className = 'ghost-button';
      declineButton.type = 'button';
      declineButton.textContent = 'No';
      declineButton.addEventListener('click', () => answerFriendRequest(request.id, false));
      actions.append(acceptButton, declineButton);
    } else {
      const status = document.createElement('span');
      status.textContent = 'In attesa';
      actions.append(status);
    }

    item.append(info, actions);
    elements.friendRequestList.append(item);
  });

  state.friendSearchResults.forEach((user) => {
    if (state.friends.some((friendship) => friendship.friend.id === user.id)) {
      return;
    }

    elements.friendSearchList.append(renderFriendRow({
      user,
      isFriend: false,
      friendshipStatus: user.friendshipStatus,
      requestedByMe: user.requestedByMe
    }));
  });
  renderOverviewBar();
};

const loadFriends = async () => {
  const [friends, requests] = await Promise.all([
    api('/friends'),
    api('/friends/requests')
  ]);
  state.friends = friends;
  state.friendRequests = requests;
  renderFriends();
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
    elements.workspaceTitle.textContent = state.user.fullName;
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

const searchFriends = async (query) => {
  if (query.trim().length < 2) {
    state.friendSearchResults = [];
    renderFriends();
    return;
  }

  state.friendSearchResults = await api(`/friends/search?q=${encodeURIComponent(query.trim())}`);
  state.friendsExpanded = true;
  renderFriends();
};

const addFriend = async (username) => {
  if (!username) {
    showToast('Inserisci uno username');
    return;
  }

  try {
    await api('/friends', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
    elements.friendUsernameInput.value = '';
    state.friendSearchResults = [];
    await loadFriends();
    showToast('Richiesta amicizia inviata');
  } catch (error) {
    showToast(error.message);
  }
};

const answerFriendRequest = async (requestId, accepted) => {
  try {
    if (accepted) {
      await api(`/friends/requests/${requestId}/accept`, { method: 'POST' });
      document.body.classList.add('friendship-burst');
      window.setTimeout(() => document.body.classList.remove('friendship-burst'), 900);
      showToast('Ora siete amici');
    } else {
      await api(`/friends/requests/${requestId}`, { method: 'DELETE' });
      showToast('Richiesta rifiutata');
    }

    await loadFriends();
  } catch (error) {
    showToast(error.message);
  }
};

const removeFriend = async (userId) => {
  try {
    await api(`/friends/${userId}`, { method: 'DELETE' });
    state.friends = state.friends.filter((friendship) => friendship.friend.id !== userId);
    renderFriends();
    showToast('Amico rimosso');
  } catch (error) {
    showToast(error.message);
  }
};

const toggleFriends = () => {
  state.friendsExpanded = !state.friendsExpanded;
  renderFriends();
};

const renderChannels = () => {
  const server = activeServer();
  elements.channelList.replaceChildren();
  elements.memberList.replaceChildren();
  elements.copyInviteButton.disabled = !server;
  elements.deleteServerButton.classList.toggle('hidden', !server);

  if (!server) {
    elements.workspaceTitle.textContent = state.user?.fullName || 'Accesso';
    elements.deleteServerButton.classList.add('hidden');
    elements.copyInviteButton.disabled = true;
    renderOverviewBar();
    return;
  }

  elements.workspaceTitle.textContent = server.name;
  elements.deleteServerButton.textContent = server.ownerId === state.user.id ? 'Elimina server' : 'Lascia server';

  server.channels.forEach((channel) => {
    const button = document.createElement('button');
    button.className = `channel-item ${channel.id === state.activeChannelId ? 'active' : ''}`;
    button.type = 'button';
    button.textContent = `${channel.type === 'TEXT' ? '#' : '◉'} ${channel.name}`;
    button.addEventListener('click', () => selectChannel(channel.id));
    elements.channelList.append(button);
  });

  server.members
    .map((membership) => membership.user)
    .filter((member) => member.id !== state.user.id)
    .forEach((member) => {
      const row = document.createElement('div');
      row.className = 'member-row';

      const button = document.createElement('button');
      button.className = `member-item ${member.id === state.activePrivateUserId ? 'active' : ''}`;
      button.type = 'button';
      const avatar = createUserAvatar(member, 'member-avatar');
      const name = document.createElement('span');
      name.textContent = member.fullName;
      button.append(avatar, name);
      button.addEventListener('click', () => selectPrivateChat(member));

      const historyButton = document.createElement('button');
      historyButton.className = 'member-history-button';
      historyButton.type = 'button';
      historyButton.title = 'Storico chiamate';
      historyButton.textContent = '↺';
      historyButton.addEventListener('click', () => showCallHistoryForUser(member));

      row.append(button, historyButton);
      elements.memberList.append(row);
    });
  renderOverviewBar();
};

const getCurrentPlayer = () => {
  return state.game?.players.find((player) => player.id === state.user.id);
};

const getOpponent = () => {
  return state.game?.players.find((player) => player.id !== state.user.id);
};

const getGameLabel = (type = state.game?.type) => {
  return type === 'HANGMAN' ? 'Impiccato' : 'Tris';
};

const setGameStatus = () => {
  if (!state.game) {
    elements.gameStatus.textContent = 'Scegli un utente dal server.';
    return;
  }

  const player = getCurrentPlayer();
  const opponent = getOpponent();

  elements.gameTitle.textContent = `${getGameLabel()} con ${opponent?.fullName || 'utente'}`;

  if (state.game.status === 'pending') {
    const invited = state.game.players[1]?.id === state.user.id;
    elements.gameStatus.textContent = invited ? 'Invito ricevuto.' : 'Invito inviato.';
    return;
  }

  if (state.game.status === 'declined') {
    elements.gameStatus.textContent = 'Invito rifiutato.';
    return;
  }

  if (state.game.status === 'waiting_link') {
    elements.gameStatus.textContent = 'Link inviato. In attesa che qualcuno entri.';
    return;
  }

  if (state.game.winner === 'draw') {
    elements.gameStatus.textContent = 'Pareggio.';
    return;
  }

  if (state.game.type === 'HANGMAN' && state.game.winner) {
    elements.gameStatus.textContent = state.game.winner === 'players'
      ? 'Parola completata. Avete vinto.'
      : 'Tentativi finiti. Avete perso.';
    return;
  }

  if (state.game.winner) {
    elements.gameStatus.textContent = state.game.winner === player?.symbol ? 'Hai vinto.' : 'Hai perso.';
    return;
  }

  elements.gameStatus.textContent = state.game.turn === player?.symbol ? 'Tocca a te.' : `Turno di ${opponent?.fullName || 'avversario'}.`;
};

const renderTicTacToeGame = (player) => {
  const canMove = state.game?.status === 'active' && state.game.turn === player?.symbol && !state.game.winner;

  elements.gameBoard.className = 'game-board';

  for (let index = 0; index < 9; index += 1) {
    const cell = document.createElement('button');
    cell.className = `game-cell ${state.game?.winningLine.includes(index) ? 'win' : ''}`;
    cell.type = 'button';
    cell.textContent = state.game?.board[index] || '';
    cell.disabled = !canMove || Boolean(state.game?.board[index]);
    cell.addEventListener('click', () => playGameMove(index));
    elements.gameBoard.append(cell);
  }
};

const renderHangmanGame = (player) => {
  const canMove = state.game?.status === 'active' && state.game.turn === player?.symbol && !state.game.winner;
  const usedLetters = new Set([
    ...(state.game?.guessedLetters || []),
    ...(state.game?.wrongLetters || [])
  ]);

  elements.gameBoard.className = 'game-board hangman-board';

  const word = document.createElement('div');
  word.className = 'hangman-word';
  word.textContent = (state.game?.maskedWord || []).join(' ');

  const attempts = document.createElement('div');
  attempts.className = 'hangman-attempts';
  attempts.textContent = `Errori: ${(state.game?.wrongLetters || []).length}/${state.game?.maxAttempts || 6}`;

  const wrong = document.createElement('div');
  wrong.className = 'hangman-wrong';
  wrong.textContent = `Lettere sbagliate: ${(state.game?.wrongLetters || []).join(', ') || '-'}`;

  const keyboard = document.createElement('div');
  keyboard.className = 'hangman-keyboard';

  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((letter) => {
    const button = document.createElement('button');
    button.className = 'hangman-key';
    button.type = 'button';
    button.textContent = letter;
    button.disabled = !canMove || usedLetters.has(letter);
    button.addEventListener('click', () => playGameMove(letter));
    keyboard.append(button);
  });

  elements.gameBoard.append(word, attempts, wrong, keyboard);
};

const renderGame = () => {
  elements.emptyState.classList.add('hidden');
  elements.adminPanel.classList.add('hidden');
  elements.callPanel.classList.add('hidden');
  elements.callHistory.classList.add('hidden');
  elements.messages.classList.add('hidden');
  elements.messageForm.classList.add('hidden');
  elements.gamePanel.classList.remove('hidden');
  elements.gameBoard.replaceChildren();

  const player = getCurrentPlayer();
  const invited = state.game?.status === 'pending' && state.game.players[1]?.id === state.user.id;

  elements.acceptGameButton.classList.toggle('hidden', !invited);
  elements.declineGameButton.classList.toggle('hidden', !invited);
  elements.restartGameButton.classList.toggle('hidden', state.game?.status !== 'finished');

  if (state.game?.type === 'HANGMAN') {
    renderHangmanGame(player);
  } else {
    renderTicTacToeGame(player);
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

const resetCall = ({ notifyPeer = false } = {}) => {
  if (notifyPeer && state.call.id && state.call.friend) {
    state.socket?.emit('private_video_call_end', {
      token: state.token,
      callId: state.call.id,
      recipientId: state.call.friend.id
    });
  }

  state.call.peer?.close();
  state.call.localStream?.getTracks().forEach((track) => track.stop());
  state.call = {
    id: null,
    peer: null,
    friend: null,
    localStream: null,
    pendingIceCandidates: [],
    incoming: false,
    active: false
  };
  elements.localVideo.srcObject = null;
  elements.remoteVideo.srcObject = null;
  elements.callPanel.classList.add('hidden');
};

const showCallPanel = (status) => {
  const friend = state.call.friend;
  elements.emptyState.classList.add('hidden');
  elements.adminPanel.classList.add('hidden');
  elements.gamePanel.classList.add('hidden');
  elements.voicePanel.classList.add('hidden');
  elements.callHistory.classList.add('hidden');
  elements.messages.classList.add('hidden');
  elements.messageForm.classList.add('hidden');
  elements.callPanel.classList.remove('hidden');
  elements.callTitle.textContent = friend ? `Con ${friend.fullName}` : 'Chiamata privata';
  elements.callStatus.textContent = status;
  elements.acceptCallButton.classList.toggle('hidden', !state.call.incoming);
  elements.declineCallButton.classList.toggle('hidden', !state.call.incoming);
};

const createCallPeer = (recipientId) => {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  state.call.localStream?.getTracks().forEach((track) => {
    peer.addTrack(track, state.call.localStream);
  });

  peer.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      state.socket.emit('private_video_call_signal', {
        token: state.token,
        callId: state.call.id,
        recipientId,
        signal: {
          type: 'ice',
          candidate: event.candidate
        }
      });
    }
  });

  peer.addEventListener('track', (event) => {
    elements.remoteVideo.srcObject = event.streams[0];
  });

  peer.addEventListener('connectionstatechange', () => {
    if (peer.connectionState === 'connected') {
      state.call.active = true;
      showCallPanel('Chiamata attiva');
    }
    if (peer.connectionState === 'disconnected') {
      showCallPanel('Connessione instabile...');
    }
    if (['closed', 'failed'].includes(peer.connectionState)) {
      resetCall();
      loadMessages();
    }
  });

  state.call.peer = peer;
  return peer;
};

const startLocalVideo = async () => {
  state.call.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  elements.localVideo.srcObject = state.call.localStream;
};

const startVideoCall = async () => {
  const friend = activePrivateUser();

  if (!friend || !state.socket?.connected) {
    showToast('Apri una chat privata prima di chiamare');
    return;
  }

  try {
    resetCall();
    state.call.id = crypto.randomUUID();
    state.call.friend = friend;
    await startLocalVideo();
    showCallPanel('Chiamata in uscita...');
    state.socket.emit('private_video_call_request', {
      token: state.token,
      recipientId: friend.id,
      callId: state.call.id
    }, (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Chiamata non avviata');
        resetCall();
        loadMessages();
      }
    });
  } catch {
    showToast('Camera o microfono non disponibili');
    resetCall();
  }
};

const acceptVideoCall = async () => {
  if (!state.call.incoming || !state.call.friend) {
    return;
  }

  try {
    await startLocalVideo();
    state.call.incoming = false;
    const peer = createCallPeer(state.call.friend.id);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    showCallPanel('Connessione in corso...');
    state.socket.emit('private_video_call_answer', {
      token: state.token,
      callId: state.call.id,
      callerId: state.call.friend.id,
      accepted: true
    });
    state.socket.emit('private_video_call_signal', {
      token: state.token,
      callId: state.call.id,
      recipientId: state.call.friend.id,
      signal: {
        type: 'offer',
        description: offer
      }
    });
  } catch {
    showToast('Camera o microfono non disponibili');
    declineVideoCall();
  }
};

const declineVideoCall = () => {
  if (state.call.friend) {
    state.socket.emit('private_video_call_answer', {
      token: state.token,
      callId: state.call.id,
      callerId: state.call.friend.id,
      accepted: false
    });
  }
  resetCall();
  loadMessages();
};

const flushVideoIceCandidates = async () => {
  if (!state.call.peer?.remoteDescription) {
    return;
  }

  const candidates = state.call.pendingIceCandidates.splice(0);

  for (const candidate of candidates) {
    await state.call.peer.addIceCandidate(new RTCIceCandidate(candidate));
  }
};

const handleVideoSignal = async ({ callId, from, signal }) => {
  if (!state.call.id || callId !== state.call.id || !state.call.friend || from.id !== state.call.friend.id) {
    return;
  }

  if (!state.call.peer) {
    createCallPeer(state.call.friend.id);
  }

  if (signal.type === 'offer') {
    await state.call.peer.setRemoteDescription(new RTCSessionDescription(signal.description));
    await flushVideoIceCandidates();
    const answer = await state.call.peer.createAnswer();
    await state.call.peer.setLocalDescription(answer);
    state.socket.emit('private_video_call_signal', {
      token: state.token,
      callId: state.call.id,
      recipientId: state.call.friend.id,
      signal: {
        type: 'answer',
        description: answer
      }
    });
    return;
  }

  if (signal.type === 'answer') {
    await state.call.peer.setRemoteDescription(new RTCSessionDescription(signal.description));
    await flushVideoIceCandidates();
    return;
  }

  if (signal.type === 'ice' && signal.candidate) {
    if (!state.call.peer.remoteDescription) {
      state.call.pendingIceCandidates.push(signal.candidate);
      return;
    }

    await state.call.peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
};

const IMAGE_ATTACHMENT_EXTENSIONS = new Set(['avif', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_ATTACHMENT_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);
const AUDIO_ATTACHMENT_EXTENSIONS = new Set(['aac', 'm4a', 'mp3', 'ogg', 'wav', 'webm']);

const getAttachmentExtension = (message) => getFileExtension(message.attachmentName || message.attachmentUrl || '');

const isImageAttachment = (message) => (
  message.attachmentMimeType?.startsWith('image/')
  || IMAGE_ATTACHMENT_EXTENSIONS.has(getAttachmentExtension(message))
);
const isVideoAttachment = (message) => (
  message.attachmentMimeType?.startsWith('video/')
  || VIDEO_ATTACHMENT_EXTENSIONS.has(getAttachmentExtension(message))
);
const isAudioAttachment = (message) => (
  message.attachmentMimeType?.startsWith('audio/')
  || AUDIO_ATTACHMENT_EXTENSIONS.has(getAttachmentExtension(message))
);

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getFileExtension = (filename = '') => filename.split('.').pop()?.toLowerCase() || '';

const isAllowedAttachment = (file) => {
  if (!file) {
    return true;
  }

  if (file.type?.startsWith('image/') || file.type?.startsWith('audio/') || file.type?.startsWith('video/')) {
    return true;
  }

  return ALLOWED_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name));
};

const validateAttachment = (file) => {
  if (!file) {
    return true;
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    showToast(`Allegato troppo grande: massimo ${formatBytes(MAX_ATTACHMENT_BYTES)}`);
    return false;
  }

  if (!isAllowedAttachment(file)) {
    showToast('Formato allegato non supportato');
    return false;
  }

  return true;
};

const renderSelectedAttachment = () => {
  const file = elements.messageFileInput.files[0];

  elements.messageAttachmentPreview.replaceChildren();
  elements.messageAttachmentPreview.classList.toggle('hidden', !file);

  if (!file) {
    return;
  }

  const name = document.createElement('span');
  name.textContent = file.name;

  const size = document.createElement('small');
  size.textContent = formatBytes(file.size);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.title = 'Rimuovi allegato';
  removeButton.textContent = 'x';
  removeButton.addEventListener('click', () => {
    elements.messageFileInput.value = '';
    renderSelectedAttachment();
  });

  elements.messageAttachmentPreview.append(name, size, removeButton);
};

const renderAttachment = (message) => {
  if (!message.attachmentUrl) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'message-attachment';

  if (isImageAttachment(message)) {
    const link = document.createElement('a');
    link.href = message.attachmentUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    const image = document.createElement('img');
    image.src = message.attachmentUrl;
    image.alt = message.attachmentName || 'Allegato';
    link.append(image);
    wrapper.append(link);
    return wrapper;
  }

  if (isVideoAttachment(message)) {
    const video = document.createElement('video');
    video.src = message.attachmentUrl;
    video.controls = true;
    wrapper.append(video);
    return wrapper;
  }

  if (isAudioAttachment(message)) {
    const audio = document.createElement('audio');
    audio.src = message.attachmentUrl;
    audio.controls = true;
    wrapper.append(audio);
    return wrapper;
  }

  const link = document.createElement('a');
  link.className = 'document-attachment';
  link.href = message.attachmentUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.download = message.attachmentName || '';
  link.textContent = `${message.attachmentName || 'Documento'} (${formatBytes(message.attachmentSize)})`;
  wrapper.append(link);
  return wrapper;
};

const renderMessage = (message) => {
  const article = document.createElement('article');
  const authorUser = message.user || message.sender;
  const ownMessage = authorUser.id === state.user?.id;
  article.className = `message ${ownMessage ? 'own' : 'other'}`;
  article.dataset.messageId = message.id;

  const avatar = createUserAvatar(authorUser);

  const body = document.createElement('div');
  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const author = document.createElement('span');
  author.className = 'message-author';
  author.textContent = authorUser.fullName;

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(message.createdAt));

  const content = document.createElement('p');
  content.className = 'message-content';
  appendMessageContent(content, message.content || '');

  meta.append(author, time);
  body.append(meta);
  if (message.content) {
    body.append(content);
  }
  const attachment = renderAttachment(message);
  if (attachment) {
    body.append(attachment);
  }
  article.append(avatar, body);
  elements.messages.append(article);
};

const getCallStatusText = (call) => {
  const ownCall = call.callerId === state.user?.id;

  if (call.status === 'DECLINED') {
    return ownCall ? 'Rifiutata' : 'Rifiutata da te';
  }

  if (call.status === 'RINGING') {
    return ownCall ? 'In uscita' : 'In arrivo';
  }

  if (call.status === 'ACCEPTED') {
    return 'Accettata';
  }

  return ownCall ? 'Effettuata' : 'Ricevuta';
};

const renderCallHistory = (calls) => {
  elements.callHistoryList.replaceChildren();

  if (!calls.length) {
    const empty = document.createElement('p');
    empty.className = 'call-history-empty';
    empty.textContent = 'Nessuna chiamata ancora.';
    elements.callHistoryList.append(empty);
    return;
  }

  calls.forEach((call) => {
    const row = document.createElement('article');
    row.className = 'call-history-item';

    const icon = document.createElement('div');
    icon.className = 'call-history-icon';
    icon.textContent = call.status === 'DECLINED' ? '!' : '↗';

    const copy = document.createElement('div');

    const title = document.createElement('strong');
    title.textContent = getCallStatusText(call);

    const detail = document.createElement('span');
    const startedAt = new Date(call.startedAt);
    detail.textContent = startedAt.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    copy.append(title, detail);
    row.append(icon, copy);
    elements.callHistoryList.append(row);
  });
};

const loadCallHistory = async (userId) => {
  const calls = await api(`/private/${userId}/calls`);
  renderCallHistory(calls);
};

const showCallHistoryForUser = async (user) => {
  resetCall();
  state.activePrivateUserId = user.id;
  state.activeChannelId = null;
  state.activeConversationType = 'private';
  state.game = null;
  renderChannels();

  elements.emptyState.classList.add('hidden');
  elements.adminPanel.classList.add('hidden');
  elements.gamePanel.classList.add('hidden');
  elements.voicePanel.classList.add('hidden');
  elements.callPanel.classList.add('hidden');
  elements.messages.classList.add('hidden');
  elements.messageForm.classList.add('hidden');
  elements.callHistory.classList.remove('hidden');
  elements.videoCallButton.classList.remove('hidden');
  elements.channelTitle.textContent = `Chiamate con ${user.fullName}`;
  elements.channelType.textContent = `Storico ${getDisplayHandle(user)}`;

  try {
    await loadCallHistory(user.id);
  } catch (error) {
    showToast(error.message);
  }
};

const loadMessages = async () => {
  const channel = activeChannel();
  const privateUser = activePrivateUser();

  elements.adminPanel.classList.add('hidden');
  elements.gamePanel.classList.add('hidden');
  elements.callPanel.classList.add('hidden');
  elements.voicePanel.classList.add('hidden');
  elements.callHistory.classList.add('hidden');
  elements.messages.replaceChildren();
  const hasConversation = state.activeConversationType === 'private' ? Boolean(privateUser) : Boolean(channel);
  elements.emptyState.classList.toggle('hidden', hasConversation);
  elements.messages.classList.toggle('hidden', !hasConversation || channel?.type === 'VOICE');
  elements.messageForm.classList.toggle('hidden', !hasConversation || channel?.type === 'VOICE');

  if (!hasConversation) {
    setDefaultEmptyState();
    elements.channelTitle.textContent = state.user ? 'Home' : 'Benvenuto in UniChat';
    elements.channelType.textContent = state.user ? 'Panoramica' : 'Canale';
    elements.videoCallButton.classList.add('hidden');
    return;
  }

  if (state.activeConversationType === 'private') {
    elements.channelTitle.textContent = privateUser.fullName;
    elements.channelType.textContent = `Privato ${getDisplayHandle(privateUser)}`;
    elements.videoCallButton.classList.remove('hidden');
    const messages = await api(`/private/${privateUser.id}/messages`);
    messages.forEach(renderMessage);
    elements.messages.scrollTop = elements.messages.scrollHeight;
    return;
  }

  elements.channelTitle.textContent = channel.name;
  elements.channelType.textContent = channel.type === 'TEXT' ? 'Canale testuale' : 'Canale vocale';
  elements.videoCallButton.classList.add('hidden');

  if (channel.type !== 'TEXT') {
    renderVoicePanel();
    return;
  }

  const messages = await api(`/channels/${channel.id}/messages`);
  messages.forEach(renderMessage);
  elements.messages.scrollTop = elements.messages.scrollHeight;
};

const selectChannel = async (channelId) => {
  resetCall();
  if (state.voice.channelId && state.voice.channelId !== channelId) {
    await leaveVoiceChannel();
  }
  state.activeChannelId = channelId;
  state.activePrivateUserId = null;
  state.activeConversationType = 'channel';
  state.socket?.emit('join_channel', channelId);
  renderChannels();
  await loadMessages();
};

const selectPrivateChat = async (user) => {
  await leaveVoiceChannel();
  resetCall();
  state.activePrivateUserId = user.id;
  state.activeChannelId = null;
  state.activeConversationType = 'private';
  state.game = null;
  renderChannels();
  await loadMessages();
};

const selectServer = async (serverId) => {
  await leaveVoiceChannel();
  resetCall();
  state.activeServerId = serverId;
  state.activePrivateUserId = null;
  state.activeConversationType = 'channel';
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

const loadServerJoinRequests = async () => {
  state.serverJoinRequests = await api('/servers/join-requests');
  renderServerJoinRequests();
};

const loadServers = async () => {
  state.servers = await api('/servers');

  if (state.activeServerId && !state.servers.some((server) => server.id === state.activeServerId)) {
    state.activeServerId = null;
  }

  renderServers();
  renderChannels();
  await loadMessages();
  await loadAvailableServers();

  if (state.pendingInviteCode) {
    await joinServerByInvite(state.pendingInviteCode);
  }
};

const loadWorkspaceData = async () => {
  await Promise.all([
    loadServers(),
    loadFriends(),
    loadServerJoinRequests()
  ]);
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

const joinServerByInvite = async (rawInviteCode) => {
  const inviteCode = extractInviteCode(rawInviteCode);

  if (!inviteCode) {
    showToast('Inserisci un codice invito');
    return;
  }

  try {
    const result = await api('/servers/join-by-invite', {
      method: 'POST',
      body: JSON.stringify({ inviteCode })
    });

    state.pendingInviteCode = null;
    localStorage.removeItem('unichat:pendingInviteCode');
    clearInviteFromUrl();
    elements.inviteCodeInput.value = '';

    if (result?.id) {
      addOrReplaceServer(result);
      state.availableServers = state.availableServers.filter((availableServer) => availableServer.id !== result.id);
      state.activeServerId = result.id;
      renderAvailableServers();
      renderServers();
      await selectServer(result.id);
      showToast('Sei entrato nel server tramite invito');
      return;
    }

    await loadAvailableServers();
    showToast(result.message || 'Richiesta inviata');
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
  const confirmed = await showConfirm(
    isOwner
      ? `Eliminare il server ${server.name}? Questa azione rimuove anche canali e messaggi.`
      : `Lasciare il server ${server.name}?`,
    isOwner ? 'Elimina server' : 'Lascia server'
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
    state.activeConversationType = 'channel';
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

const buildMessageFormData = () => {
  const formData = new FormData();
  const content = elements.messageInput.value.trim();
  const file = elements.messageFileInput.files[0];

  if (!validateAttachment(file)) {
    return { formData, content, file: null, valid: false };
  }

  if (content) {
    formData.append('content', content);
  }

  if (file) {
    formData.append('file', file);
  }

  return { formData, content, file, valid: true };
};

const clearComposer = () => {
  elements.messageInput.value = '';
  elements.messageFileInput.value = '';
  renderSelectedAttachment();
};

const sendMessageWithUpload = async ({ formData, file }) => {
  let message = null;

  if (state.activeConversationType === 'private') {
    const privateUser = activePrivateUser();
    if (!privateUser) {
      return;
    }
    message = await api(`/private/${privateUser.id}/messages`, {
      method: 'POST',
      body: formData
    });
  } else if (file && state.activeChannelId) {
    message = await api(`/channels/${state.activeChannelId}/messages`, {
      method: 'POST',
      body: formData
    });
  }

  if (message && !elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
    renderMessage(message);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }
};

const renderVoiceParticipants = () => {
  elements.voiceParticipants.replaceChildren();

  state.voice.participants.forEach((participant) => {
    const item = document.createElement('div');
    item.className = 'voice-participant';
    item.append(createUserAvatar(participant, 'member-avatar'));
    const name = document.createElement('span');
    name.textContent = participant.id === state.user?.id ? `${participant.fullName} (tu)` : participant.fullName;
    item.append(name);
    elements.voiceParticipants.append(item);
  });
};

const getSpeechRecognitionConstructor = () => window.SpeechRecognition || window.webkitSpeechRecognition;

const renderVoiceTranscripts = () => {
  elements.voiceTranscriptList.replaceChildren();

  if (!state.voice.transcripts.length) {
    const empty = document.createElement('p');
    empty.className = 'voice-transcript-empty';
    empty.textContent = 'Nessuna trascrizione ancora.';
    elements.voiceTranscriptList.append(empty);
  } else {
    state.voice.transcripts.forEach((entry) => {
      const item = document.createElement('article');
      item.className = 'voice-transcript-item';

      const meta = document.createElement('div');
      meta.className = 'voice-transcript-meta';

      const name = document.createElement('strong');
      name.textContent = entry.user?.id === state.user?.id ? 'Tu' : entry.user?.fullName || 'Utente';

      const time = document.createElement('time');
      time.dateTime = entry.createdAt;
      time.textContent = new Date(entry.createdAt).toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit'
      });

      meta.append(name, time);

      const text = document.createElement('p');
      text.textContent = entry.text;

      item.append(meta, text);
      elements.voiceTranscriptList.append(item);
    });
  }

  elements.voiceTranscriptInterim.textContent = state.voice.transcriptInterim
    ? `Sto ascoltando: ${state.voice.transcriptInterim}`
    : '';
  elements.voiceTranscriptInterim.classList.toggle('hidden', !state.voice.transcriptInterim);
  elements.voiceTranscriptList.scrollTop = elements.voiceTranscriptList.scrollHeight;
};

const addVoiceTranscript = (entry) => {
  if (!entry?.text) {
    return;
  }

  state.voice.transcripts.push(entry);
  state.voice.transcripts = state.voice.transcripts.slice(-80);
  renderVoiceTranscripts();
};

const stopVoiceTranscription = () => {
  state.voice.shouldTranscribe = false;
  state.voice.transcriptInterim = '';

  if (state.voice.recognition) {
    state.voice.recognition.onend = null;
    state.voice.recognition.onerror = null;
    state.voice.recognition.onresult = null;
    try {
      state.voice.recognition.stop();
    } catch {
      // The browser can throw if recognition already stopped itself.
    }
    state.voice.recognition = null;
  }

  renderVoiceTranscripts();
};

const startVoiceTranscription = () => {
  const SpeechRecognition = getSpeechRecognitionConstructor();

  if (!SpeechRecognition) {
    elements.voiceTranscriptStatus.textContent = 'Trascrizione non supportata da questo browser.';
    return;
  }

  stopVoiceTranscription();

  const recognition = new SpeechRecognition();
  recognition.lang = 'it-IT';
  recognition.continuous = true;
  recognition.interimResults = true;

  state.voice.shouldTranscribe = true;
  state.voice.recognition = recognition;
  elements.voiceTranscriptStatus.textContent = 'Trascrizione attiva.';

  recognition.onresult = (event) => {
    let finalText = '';
    let interimText = '';

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0]?.transcript?.trim();

      if (!text) {
        continue;
      }

      if (result.isFinal) {
        finalText = `${finalText} ${text}`.trim();
      } else {
        interimText = `${interimText} ${text}`.trim();
      }
    }

    state.voice.transcriptInterim = interimText;
    renderVoiceTranscripts();

    if (finalText && state.voice.channelId && state.socket?.connected) {
      state.socket.emit('voice_transcript', {
        channelId: state.voice.channelId,
        text: finalText
      });
    }
  };

  recognition.onerror = () => {
    elements.voiceTranscriptStatus.textContent = 'Trascrizione interrotta dal browser.';
  };

  recognition.onend = () => {
    state.voice.recognition = null;

    if (state.voice.shouldTranscribe && state.voice.channelId) {
      window.setTimeout(startVoiceTranscription, 500);
      return;
    }

    elements.voiceTranscriptStatus.textContent = state.voice.channelId
      ? 'Trascrizione ferma.'
      : 'Disponibile dopo l\'ingresso nel canale.';
  };

  try {
    recognition.start();
  } catch {
    state.voice.recognition = null;
    state.voice.shouldTranscribe = false;
    elements.voiceTranscriptStatus.textContent = 'Trascrizione non avviata dal browser.';
  }
};

const renderVoicePanel = () => {
  const channel = activeChannel();

  elements.emptyState.classList.add('hidden');
  elements.messages.classList.add('hidden');
  elements.messageForm.classList.add('hidden');
  elements.callHistory.classList.add('hidden');
  elements.voicePanel.classList.remove('hidden');
  elements.voiceTitle.textContent = channel?.name || 'Canale vocale';
  elements.voiceStatus.textContent = state.voice.channelId === channel?.id
    ? 'Sei nel canale vocale.'
    : 'Entra nel canale per parlare.';
  elements.voiceTranscriptStatus.textContent = state.voice.channelId === channel?.id
    ? elements.voiceTranscriptStatus.textContent
    : 'Disponibile dopo l\'ingresso nel canale.';
  elements.joinVoiceButton.classList.toggle('hidden', state.voice.channelId === channel?.id);
  elements.leaveVoiceButton.classList.toggle('hidden', state.voice.channelId !== channel?.id);
  renderVoiceParticipants();
  renderVoiceTranscripts();
};

const addRemoteAudio = (socketId, stream) => {
  let audio = elements.remoteAudio.querySelector(`[data-socket-id="${socketId}"]`);

  if (!audio) {
    audio = document.createElement('audio');
    audio.dataset.socketId = socketId;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.muted = state.userDock.deafened;
    elements.remoteAudio.append(audio);
  }

  audio.srcObject = stream;
};

const closeVoicePeer = (socketId) => {
  const peer = state.voice.peers.get(socketId);

  if (peer) {
    peer.close();
    state.voice.peers.delete(socketId);
  }

  elements.remoteAudio.querySelector(`[data-socket-id="${socketId}"]`)?.remove();
};

const createVoicePeer = (socketId) => {
  const existingPeer = state.voice.peers.get(socketId);

  if (existingPeer) {
    return existingPeer;
  }

  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  state.voice.localStream?.getTracks().forEach((track) => {
    peer.addTrack(track, state.voice.localStream);
  });

  peer.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      state.socket.emit('voice_signal', {
        to: socketId,
        signal: {
          type: 'ice',
          candidate: event.candidate
        }
      });
    }
  });

  peer.addEventListener('track', (event) => {
    addRemoteAudio(socketId, event.streams[0]);
  });

  peer.addEventListener('connectionstatechange', () => {
    if (['closed', 'failed', 'disconnected'].includes(peer.connectionState)) {
      closeVoicePeer(socketId);
    }
  });

  state.voice.peers.set(socketId, peer);
  return peer;
};

const callVoicePeer = async (socketId) => {
  const peer = createVoicePeer(socketId);
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  state.socket.emit('voice_signal', {
    to: socketId,
    signal: {
      type: 'offer',
      description: offer
    }
  });
};

const handleVoiceSignal = async ({ from, signal }) => {
  if (!from || !signal || !state.voice.localStream) {
    return;
  }

  const peer = createVoicePeer(from);

  if (signal.type === 'offer') {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    state.socket.emit('voice_signal', {
      to: from,
      signal: {
        type: 'answer',
        description: answer
      }
    });
    return;
  }

  if (signal.type === 'answer') {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
    return;
  }

  if (signal.type === 'ice' && signal.candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
};

const joinVoiceChannel = async () => {
  const channel = activeChannel();

  if (!channel || channel.type !== 'VOICE') {
    return;
  }

  try {
    if (!state.voice.localStream) {
      state.voice.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      updateVoiceAudioState();
    }

    state.socket.emit('voice_join_channel', {
      token: state.token,
      channelId: channel.id
    }, async (response) => {
      if (!response?.ok) {
        showToast(response?.error || 'Canale vocale non disponibile');
        return;
      }

      state.voice.channelId = channel.id;
      state.voice.participants = response.participants || state.voice.participants;
      state.voice.transcripts = [];
      renderVoicePanel();
      startVoiceTranscription();

      for (const peer of response.peers || []) {
        await callVoicePeer(peer.socketId);
      }
    });
  } catch {
    showToast('Permesso microfono negato o non disponibile');
  }
};

const leaveVoiceChannel = async () => {
  if (!state.voice.channelId) {
    return;
  }

  state.socket?.emit('voice_leave_channel');
  stopVoiceTranscription();
  state.voice.peers.forEach((peer) => peer.close());
  state.voice.peers.clear();
  state.voice.localStream?.getTracks().forEach((track) => track.stop());
  state.voice.localStream = null;
  state.voice.channelId = null;
  state.voice.participants = [];
  state.voice.transcripts = [];
  elements.remoteAudio.replaceChildren();
  renderUserDock();

  if (activeChannel()?.type === 'VOICE') {
    renderVoicePanel();
  }
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

    state.socket.emit('authenticate', { token: state.token }, (response) => {
      if (response?.ok) {
        joinPendingGameFromUrl();
      }
    });
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

  state.socket.on('private_message_created', (message) => {
    const privateUser = activePrivateUser();
    const currentUserId = state.user?.id;

    if (
      state.activeConversationType !== 'private'
      || !privateUser
      || !currentUserId
      || ![message.senderId, message.recipientId].includes(currentUserId)
      || ![message.senderId, message.recipientId].includes(privateUser.id)
    ) {
      return;
    }

    if (elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
      return;
    }

    renderMessage(message);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  });

  state.socket.on('friendship_changed', () => {
    loadFriends().catch((error) => showToast(error.message));
  });

  state.socket.on('voice_participants', ({ channelId, participants }) => {
    if (channelId !== state.voice.channelId) {
      return;
    }

    state.voice.participants = participants || [];
    renderVoiceParticipants();
  });

  state.socket.on('voice_peer_joined', () => {
    renderVoiceParticipants();
  });

  state.socket.on('voice_peer_left', ({ socketId }) => {
    closeVoicePeer(socketId);
  });

  state.socket.on('voice_signal', (payload) => {
    handleVoiceSignal(payload).catch(() => showToast('Segnale vocale non valido'));
  });

  state.socket.on('voice_transcript', (entry) => {
    if (entry.channelId !== state.voice.channelId) {
      return;
    }

    addVoiceTranscript(entry);
  });

  state.socket.on('private_video_call_incoming', ({ callId, from }) => {
    resetCall();
    state.call.id = callId;
    state.call.friend = from;
    state.call.incoming = true;
    showCallPanel(`Chiamata in arrivo da ${from.fullName}`);
  });

  state.socket.on('private_video_call_answered', async ({ callId, accepted, from }) => {
    if (callId !== state.call.id) {
      return;
    }

    if (!accepted) {
      showToast('Chiamata rifiutata');
      resetCall();
      await loadMessages();
      return;
    }

    state.call.friend = from;
    createCallPeer(from.id);
    showCallPanel('Connessione in corso...');
  });

  state.socket.on('private_video_call_signal', (payload) => {
    handleVideoSignal(payload).catch(() => showToast('Videochiamata non riuscita'));
  });

  state.socket.on('private_video_call_ended', ({ callId }) => {
    if (callId !== state.call.id) {
      return;
    }

    showToast('Chiamata terminata');
    resetCall();
    loadMessages();
  });

  state.socket.on('private_game_invite', (game) => {
    showGame(game);
    showToast(`Invito a ${getGameLabel(game.type)} da ${game.players[0].fullName}`);
  });

  state.socket.on('private_game_update', (game) => {
    showGame(game);
  });
};

const startPrivateGame = (opponentId, type = state.selectedGameType) => {
  const server = activeServer();

  if (!state.socket?.connected) {
    showToast('Connessione non disponibile');
    return;
  }

  state.activePrivateUserId = opponentId;
  state.socket.emit('private_game_request', {
    token: state.token,
    opponentId,
    serverId: server?.id || null,
    type
  }, (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Partita non avviata');
      return;
    }

    showGame(response.game);
  });
};

const getPlayableMembers = () => {
  return state.friends.map((friendship) => friendship.friend);
};

const renderGameLauncher = () => {
  elements.gameFriendList.replaceChildren();
  elements.gameTypeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.gameType === state.selectedGameType);
  });

  const members = getPlayableMembers();
  elements.sendGameLinkButton.disabled = !activeServer() || (!state.activeChannelId && state.activeConversationType !== 'private');

  if (members.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'game-launcher-empty';
    empty.textContent = 'Nessun amico disponibile.';
    elements.gameFriendList.append(empty);
    return;
  }

  members.forEach((member) => {
    const button = document.createElement('button');
    button.className = 'game-launcher-user';
    button.type = 'button';

    const name = document.createElement('span');
    name.textContent = member.fullName;

    button.append(createUserAvatar(member, 'member-avatar'), name);
    button.addEventListener('click', () => {
      elements.gameDialog.close();
      startPrivateGame(member.id, state.selectedGameType);
    });
    elements.gameFriendList.append(button);
  });
};

const openGameDialog = () => {
  if (!state.user) {
    showToast('Accedi per giocare');
    return;
  }

  renderGameLauncher();
  elements.gameDialog.showModal();
};

const postTextToActiveConversation = async (content) => {
  if (state.activeConversationType === 'private') {
    const privateUser = activePrivateUser();

    if (!privateUser) {
      throw new Error('Apri una chat privata');
    }

    const formData = new FormData();
    formData.append('content', content);
    await api(`/private/${privateUser.id}/messages`, {
      method: 'POST',
      body: formData
    });
    return;
  }

  if (!state.activeChannelId) {
    throw new Error('Apri un canale testuale');
  }

  await new Promise((resolve, reject) => {
    state.socket.emit('send_message', {
      token: state.token,
      channelId: state.activeChannelId,
      content
    }, (response) => {
      if (!response?.ok) {
        reject(new Error(response?.error || 'Messaggio non inviato'));
        return;
      }
      resolve(response.message);
    });
  });
};

const sendGameLinkToChat = () => {
  const server = activeServer();

  if (!server || !state.socket?.connected) {
    showToast('Connessione non disponibile');
    return;
  }

  state.socket.emit('private_game_link_create', {
    token: state.token,
    serverId: server.id,
    type: state.selectedGameType
  }, async (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Link non creato');
      return;
    }

    const gameUrl = `${window.location.origin}${window.location.pathname}?game=${response.game.id}`;
    const gameLabel = getGameLabel(response.game.type);

    try {
      await postTextToActiveConversation(`Invito a ${gameLabel}: ${gameUrl}`);
      elements.gameDialog.close();
      showGame(response.game);
      showToast(`Link ${gameLabel} inviato`);
    } catch (error) {
      showToast(error.message);
    }
  });
};

const clearGameFromUrl = () => {
  if (!new URLSearchParams(window.location.search).has('game')) {
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname);
};

const joinPendingGameFromUrl = () => {
  if (!state.pendingGameId || !state.socket?.connected) {
    return;
  }

  state.socket.emit('private_game_link_join', {
    token: state.token,
    gameId: state.pendingGameId
  }, (response) => {
    if (!response?.ok) {
      showToast(response?.error || 'Invito gioco non disponibile');
      return;
    }

    state.pendingGameId = null;
    clearGameFromUrl();
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
    await loadWorkspaceData();
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

bootstrap().catch((error) => showToast(error.message));
