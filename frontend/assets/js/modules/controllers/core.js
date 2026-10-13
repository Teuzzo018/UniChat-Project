export const registerCoreController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;

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

  Object.assign(app, {
    activeServer,
    extractInviteCode,
    clearInviteFromUrl,
    activeChannel,
    activePrivateUser
  });
};
