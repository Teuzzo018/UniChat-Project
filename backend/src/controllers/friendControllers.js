const prisma = require('../lib/prisma');

const userSummarySelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  avatarUrl: true,
  role: true
};

const normalizeUsername = (value) => {
  return String(value || '').trim().toLowerCase();
};

const getFriendshipPair = (firstUserId, secondUserId) => {
  return [firstUserId, secondUserId].sort();
};

const friendshipWhereForUser = (userId) => ({
  OR: [
    { requesterId: userId },
    { addresseeId: userId }
  ]
});

const formatFriendship = (friendship, currentUserId) => {
  const friend = friendship.requesterId === currentUserId
    ? friendship.addressee
    : friendship.requester;

  return {
    id: friendship.id,
    createdAt: friendship.createdAt,
    friend
  };
};

const listFriends = async (req, res) => {
  const friendships = await prisma.friendship.findMany({
    where: friendshipWhereForUser(req.user.id),
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { select: userSummarySelect },
      addressee: { select: userSummarySelect }
    }
  });

  return res.status(200).json(friendships.map((friendship) => formatFriendship(friendship, req.user.id)));
};

const searchUsers = async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (query.length < 2) {
    return res.status(200).json([]);
  }

  const [users, friendships] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: { fullName: 'asc' },
      take: 12,
      select: userSummarySelect
    }),
    prisma.friendship.findMany({
      where: friendshipWhereForUser(req.user.id),
      select: {
        requesterId: true,
        addresseeId: true
      }
    })
  ]);

  const friendIds = new Set(friendships.map((friendship) => (
    friendship.requesterId === req.user.id ? friendship.addresseeId : friendship.requesterId
  )));

  return res.status(200).json(users.map((user) => ({
    ...user,
    isFriend: friendIds.has(user.id)
  })));
};

const addFriend = async (req, res) => {
  const username = normalizeUsername(req.body.username);

  if (!username) {
    return res.status(400).json({ error: 'Username mancante' });
  }

  const targetUser = await prisma.user.findUnique({
    where: { username },
    select: userSummarySelect
  });

  if (!targetUser) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  if (targetUser.id === req.user.id) {
    return res.status(400).json({ error: 'Non puoi aggiungere te stesso' });
  }

  const [requesterId, addresseeId] = getFriendshipPair(req.user.id, targetUser.id);
  const friendship = await prisma.friendship.upsert({
    where: {
      requesterId_addresseeId: {
        requesterId,
        addresseeId
      }
    },
    update: {},
    create: {
      requesterId,
      addresseeId
    },
    include: {
      requester: { select: userSummarySelect },
      addressee: { select: userSummarySelect }
    }
  });

  return res.status(201).json(formatFriendship(friendship, req.user.id));
};

const removeFriend = async (req, res) => {
  const friendId = req.params.userId;

  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: req.user.id, addresseeId: friendId },
        { requesterId: friendId, addresseeId: req.user.id }
      ]
    }
  });

  return res.status(200).json({ message: 'Amico rimosso' });
};

module.exports = {
  addFriend,
  listFriends,
  removeFriend,
  searchUsers
};
