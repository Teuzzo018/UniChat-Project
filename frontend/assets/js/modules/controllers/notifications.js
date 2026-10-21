export const registerNotificationsController = (app) => {
  const { state, api } = app;
  state.unread = { channels: {}, private: {} };
  let refreshSequence = 0;

  const renderUnread = () => {
    app.renderChannels();
    app.renderDirectMessages();
  };

  const loadUnread = async () => {
    if (!state.user) return;
    const sequence = ++refreshSequence;
    const unread = await api('/notifications/unread');
    if (sequence !== refreshSequence) return;
    state.unread = unread;
    renderUnread();
  };

  const markRead = async (kind, targetId, through) => {
    if (!targetId || !through || !state.user) return;
    const bucket = kind === 'channel' ? 'channels' : 'private';
    ++refreshSequence;
    state.unread[bucket][targetId] = 0;
    renderUnread();
    try {
      await api(`/notifications/read/${kind}/${targetId}`, {
        method: 'PUT', body: JSON.stringify({ through })
      });
    } catch (error) { app.showToast(error.message); }
  };

  const receiveUnread = (kind, targetId, message) => {
    if (!state.user || !targetId) return;
    const own = kind === 'channel' ? message.userId === state.user.id : message.senderId === state.user.id;
    if (own || message.kind && message.kind !== 'USER') return;
    const active = kind === 'channel'
      ? state.activeConversationType === 'channel' && state.activeChannelId === targetId
      : state.activeConversationType === 'private' && state.activePrivateUserId === targetId;
    if (active && !document.hidden) {
      markRead(kind, targetId, message.createdAt);
      return;
    }
    const bucket = kind === 'channel' ? 'channels' : 'private';
    state.unread[bucket][targetId] = (state.unread[bucket][targetId] || 0) + 1;
    renderUnread();
  };

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !state.user) return;
    if (state.activeConversationType === 'channel' && state.activeChannelId) {
      await markRead('channel', state.activeChannelId, new Date().toISOString());
    } else if (state.activeConversationType === 'private' && state.activePrivateUserId) {
      await markRead('private', state.activePrivateUserId, new Date().toISOString());
    }
    loadUnread().catch((error) => app.showToast(error.message));
  });

  Object.assign(app, { loadUnread, markRead, receiveUnread });
};
