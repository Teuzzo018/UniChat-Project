export const registerFriendsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const selectPrivateChat = (...args) => app.selectPrivateChat(...args);
  const showCallHistoryForUser = (...args) => app.showCallHistoryForUser(...args);
  const renderOverviewBar = (...args) => app.renderOverviewBar(...args);
  const renderSettingsLists = (...args) => app.renderSettingsLists(...args);

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
      const presence = document.createElement('span');
      presence.className = state.friendPresence[user.id] ? 'friend-presence online' : 'friend-presence';
      presence.textContent = state.friendPresence[user.id] ? 'Online' : 'Offline';
      info.append(presence);
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
    if (!state.friends.length) {
      const empty = document.createElement('p');
      empty.className = 'sidebar-empty';
      empty.textContent = 'Non hai ancora amici. Cerca un username qui sopra.';
      elements.friendList.append(empty);
    }
    app.renderDirectMessages?.();

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
        const cancelButton = document.createElement('button');
        cancelButton.className = 'ghost-button';
        cancelButton.type = 'button';
        cancelButton.textContent = 'Annulla';
        cancelButton.addEventListener('click', () => cancelFriendRequest(request.id));
        actions.append(cancelButton);
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
    const visible = new Set(friends.map((item) => item.friend.id));
    for (const id of Object.keys(state.friendPresence)) if (!visible.has(id)) delete state.friendPresence[id];
    if (state.call.id && state.call.friend && !visible.has(state.call.friend.id)) {
      app.closeCall('Conversazione privata non più disponibile');
    }
    if (state.activeConversationType === 'private' && !visible.has(state.activePrivateUserId)) {
      state.activePrivateUserId = null;
      state.activeConversationType = 'channel';
      app.loadMessages().catch((error) => showToast(error.message));
    }
    renderFriends();
    app.renderChannels();
    renderSettingsLists();
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

  const cancelFriendRequest = async (requestId) => {
    try {
      await api(`/friends/requests/${requestId}/cancel`, { method: 'DELETE' });
      await loadFriends();
      showToast('Richiesta annullata');
    } catch (error) { showToast(error.message); }
  };

  const removeFriend = async (userId) => {
    try {
      await api(`/friends/${userId}`, { method: 'DELETE' });
      await loadFriends();
      showToast('Amico rimosso');
    } catch (error) {
      showToast(error.message);
    }
  };

  const toggleFriends = () => {
    state.friendsExpanded = !state.friendsExpanded;
    renderFriends();
  };

  Object.assign(app, {
    renderFriendRow,
    renderFriends,
    loadFriends,
    searchFriends,
    addFriend,
    answerFriendRequest,
    removeFriend,
    toggleFriends
  });
};
