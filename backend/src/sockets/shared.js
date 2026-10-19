const prisma = require('../lib/prisma');
const { hashSessionToken } = require('../utils/sessionTokens');

const getUserFromToken = async (token) => {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date() || session.user.suspendedAt) {
    return null;
  }

  return session.user;
};

const getAuthenticatedSocketUser = async (socket, token = socket.data.token) => {
  if (!socket.data.token || token !== socket.data.token || !socket.data.user) return null;
  const user = await getUserFromToken(token);
  return user?.id === socket.data.user.id ? user : null;
};

const getUserRoom = (userId) => `user:${userId}`;
const getChannelRoom = (channelId) => `channel:${channelId}`;
const getVoiceRoom = (channelId) => `voice:${channelId}`;

const getSocketUserSummary = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  avatarUrl: user.avatarUrl
});

module.exports = {
  getChannelRoom,
  getSocketUserSummary,
  getUserFromToken,
  getAuthenticatedSocketUser,
  getUserRoom,
  getVoiceRoom
};
