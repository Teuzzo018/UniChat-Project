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

const getUserRoom = (userId) => `user:${userId}`;

const emitFriendshipEvent = (req, userIds, eventName, payload = {}) => {
  const io = req.app.get('io');

  if (!io) {
    return;
  }

  userIds.forEach((userId) => {
    io.to(getUserRoom(userId)).emit(eventName, payload);
  });
};

const formatFriendship = (friendship, currentUserId) => {
  const friend = friendship.requesterId === currentUserId
    ? friendship.addressee
    : friendship.requester;

  return {
    id: friendship.id,
    createdAt: friendship.createdAt,
    status: friendship.status,
    requestedById: friendship.requestedById,
    friend
  };
};

const listFriends = async (req, res) => {
  const friendships = await prisma.friendship.findMany({
    where: {
      ...friendshipWhereForUser(req.user.id),
      status: 'ACCEPTED'
    },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { select: userSummarySelect },
      addressee: { select: userSummarySelect }
    }
  });

  return res.status(200).json(friendships.map((friendship) => formatFriendship(friendship, req.user.id)));
};

const listFriendRequests = async (req, res) => {
  const friendships = await prisma.friendship.findMany({
    where: {
      ...friendshipWhereForUser(req.user.id),
      status: 'PENDING'
    },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { select: userSummarySelect },
      addressee: { select: userSummarySelect }
    }
  });

  return res.status(200).json(friendships.map((friendship) => ({
    ...formatFriendship(friendship, req.user.id),
    incoming: friendship.requestedById !== req.user.id
  })));
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
        addresseeId: true,
        requestedById: true,
        status: true
      }
    })
  ]);

  const friendshipByUserId = new Map(friendships.map((friendship) => {
    const otherUserId = friendship.requesterId === req.user.id ? friendship.addresseeId : friendship.requesterId;
    return [otherUserId, friendship];
  }));

  return res.status(200).json(users.map((user) => ({
    ...user,
    friendshipStatus: friendshipByUserId.get(user.id)?.status || null,
    requestedByMe: friendshipByUserId.get(user.id)?.requestedById === req.user.id,
    isFriend: friendshipByUserId.get(user.id)?.status === 'ACCEPTED'
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
      addresseeId,
      requestedById: req.user.id,
      status: 'PENDING'
    },
    include: {
      requester: { select: userSummarySelect },
      addressee: { select: userSummarySelect }
    }
  });

  emitFriendshipEvent(req, [req.user.id, targetUser.id], 'friendship_changed', {
    friendshipId: friendship.id,
    status: friendship.status
  });

  return res.status(friendship.status === 'ACCEPTED' ? 200 : 201).json(formatFriendship(friendship, req.user.id));
};

const acceptFriendRequest = async (req, res) => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: req.params.id },
    include: {
      requester: { select: userSummarySelect },
      addressee: { select: userSummarySelect }
    }
  });

  if (
    !friendship
    || friendship.status !== 'PENDING'
    || ![friendship.requesterId, friendship.addresseeId].includes(req.user.id)
    || friendship.requestedById === req.user.id
  ) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  const acceptedFriendship = await prisma.friendship.update({
    where: { id: friendship.id },
    data: { status: 'ACCEPTED' },
    include: {
      requester: { select: userSummarySelect },
      addressee: { select: userSummarySelect }
    }
  });

  emitFriendshipEvent(req, [acceptedFriendship.requesterId, acceptedFriendship.addresseeId], 'friendship_changed', {
    friendshipId: acceptedFriendship.id,
    status: acceptedFriendship.status
  });

  return res.status(200).json(formatFriendship(acceptedFriendship, req.user.id));
};

const declineFriendRequest = async (req, res) => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      requesterId: true,
      addresseeId: true,
      requestedById: true,
      status: true
    }
  });

  if (
    !friendship
    || friendship.status !== 'PENDING'
    || ![friendship.requesterId, friendship.addresseeId].includes(req.user.id)
    || friendship.requestedById === req.user.id
  ) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  await prisma.friendship.delete({ where: { id: friendship.id } });
  emitFriendshipEvent(req, [friendship.requesterId, friendship.addresseeId], 'friendship_changed', {
    friendshipId: friendship.id,
    status: 'DECLINED'
  });
  return res.status(200).json({ message: 'Richiesta rifiutata' });
};

const removeFriend = async (req, res) => {
  const friendId = req.params.userId;

  const deletedFriendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: req.user.id, addresseeId: friendId },
        { requesterId: friendId, addresseeId: req.user.id }
      ]
    },
    select: {
      id: true,
      requesterId: true,
      addresseeId: true
    }
  });

  await prisma.friendship.deleteMany({
    where: {
      id: { in: deletedFriendships.map((friendship) => friendship.id) }
    }
  });

  deletedFriendships.forEach((friendship) => {
    emitFriendshipEvent(req, [friendship.requesterId, friendship.addresseeId], 'friendship_changed', {
      friendshipId: friendship.id,
      status: 'REMOVED'
    });
  });

  return res.status(200).json({ message: 'Amico rimosso' });
};

module.exports = {
  acceptFriendRequest,
  addFriend,
  declineFriendRequest,
  listFriends,
  listFriendRequests,
  removeFriend,
  searchUsers
};
