const prisma = require('../lib/prisma');
const { getUserRoom } = require('./shared');

const visibleFriendIds = async (userId) => {
  const [friendships, blocks] = await Promise.all([
    prisma.friendship.findMany({ where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }]
    }, select: { requesterId: true, addresseeId: true } }),
    prisma.blockedUser.findMany({ where: {
      OR: [{ blockerId: userId }, { blockedId: userId }]
    }, select: { blockerId: true, blockedId: true } })
  ]);
  const blocked = new Set(blocks.map((item) => item.blockerId === userId ? item.blockedId : item.blockerId));
  return friendships.map((item) => item.requesterId === userId ? item.addresseeId : item.requesterId)
    .filter((id) => !blocked.has(id));
};

const isOnline = async (io, userId) => (await io.in(getUserRoom(userId)).fetchSockets()).length > 0;

const sendSnapshot = async (io, socket, userId) => {
  const friends = await visibleFriendIds(userId);
  const presence = await Promise.all(friends.map(async (id) => {
    const friend = await prisma.user.findUnique({ where: { id }, select: { suspendedAt: true } });
    return { userId: id, online: Boolean(friend && !friend.suspendedAt && await isOnline(io, id)) };
  }));
  socket.emit('presence_snapshot', presence);
};

const announce = async (io, userId, online) => {
  const friends = await visibleFriendIds(userId);
  for (const id of friends) io.to(getUserRoom(id)).emit('presence_changed', { userId, online });
};

module.exports = { visibleFriendIds, isOnline, sendSnapshot, announce };
