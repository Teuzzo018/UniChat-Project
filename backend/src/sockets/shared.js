const prisma = require('../lib/prisma');
const { hashSessionToken } = require('../utils/sessionTokens');

const getUserFromToken = async (token) => {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
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
  getUserRoom,
  getVoiceRoom
};
