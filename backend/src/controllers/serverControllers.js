const crypto = require('crypto');

const prisma = require('../lib/prisma');
const { canManageServer, isSuperadmin } = require('../lib/authorization');
const { parseInviteCode, isInviteActive, redeemInvite } = require('../utils/serverInvites');

const serverSelect = {
  id: true,
  name: true,
  description: true,
  isDiscoverable: true,
  universityId: true,
  ownerId: true,
  createdAt: true,
  channels: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true
    }
  },
  members: {
    select: {
      isAdmin: true,
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
          role: true
        }
      }
    }
  }
};

const createInviteCode = () => crypto.randomBytes(16).toString('hex');

const createUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = createInviteCode();
    const existingServer = await prisma.server.findUnique({
      where: { inviteCode },
      select: { id: true }
    });

    if (!existingServer) {
      return inviteCode;
    }
  }

  throw new Error('Impossibile generare un codice invito univoco');
};

const ensureServerMember = async (serverId, userId) => {
  return prisma.serverMember.findUnique({
    where: {
      userId_serverId: {
        userId,
        serverId
      }
    }
  });
};

const ensureServerOwner = async (serverId, userId) => {
  return prisma.server.findFirst({
    where: {
      id: serverId,
      ownerId: userId
    },
    select: { id: true }
  });
};

const joinRequestSelect = {
  id: true,
  status: true,
  createdAt: true,
  server: {
    select: {
      id: true,
      name: true
    }
  },
  user: {
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      avatarUrl: true
    }
  }
};

const listServers = async (req, res) => {
  const memberships = await prisma.serverMember.findMany({
    where: { userId: req.user.id },
    include: { server: { select: serverSelect } },
    orderBy: { server: { createdAt: 'asc' } }
  });

  return res.status(200).json(memberships.map((membership) => membership.server));
};

const listAvailableServers = async (req, res) => {
  if (!req.user.universityId) {
    return res.status(200).json([]);
  }

  const servers = await prisma.server.findMany({
    where: {
      universityId: req.user.universityId,
      isDiscoverable: true,
      members: {
        none: {
          userId: req.user.id
        }
      },
      joinRequests: {
        none: {
          userId: req.user.id,
          status: 'PENDING'
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      isDiscoverable: true
    }
  });

  return res.status(200).json(servers);
};

const listServerJoinRequests = async (req, res) => {
  const requests = await prisma.serverJoinRequest.findMany({
    where: {
      status: 'PENDING',
      ...(!isSuperadmin(req.user) ? { server: { OR: [
        { ownerId: req.user.id },
        { members: { some: { userId: req.user.id, isAdmin: true } } }
      ] } } : {})
    },
    orderBy: { createdAt: 'asc' },
    select: joinRequestSelect
  });

  return res.status(200).json(requests);
};

const createServer = async (req, res) => {
  const { name, description } = req.body || {};

  if (!req.user.universityId) {
    return res.status(400).json({ error: 'Per creare un server devi avere una università associata' });
  }

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || (description != null && (typeof description !== 'string' || description.length > 1000))) {
    return res.status(400).json({ error: 'Il nome del server deve contenere almeno 2 caratteri' });
  }

  const server = await prisma.server.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      inviteCode: await createUniqueInviteCode(),
      isDiscoverable: req.body?.isDiscoverable === true,
      universityId: req.user.universityId,
      ownerId: req.user.id,
      members: {
        create: {
          userId: req.user.id
        }
      },
      channels: {
        create: [
          { name: 'generale', type: 'TEXT' },
          { name: 'materiali', type: 'TEXT' },
          { name: 'studio-vocale', type: 'VOICE' }
        ]
      }
    },
    select: serverSelect
  });

  return res.status(201).json(server);
};

const joinServerByInvite = async (req, res) => {
  const inviteCode = parseInviteCode(req.body?.inviteCode);

  if (!inviteCode) {
    return res.status(400).json({ error: 'Codice invito mancante' });
  }

  let result;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await prisma.$transaction((tx) => redeemInvite(tx, inviteCode, req.user.id));
      break;
    } catch (error) {
      if (!['P2002', 'P2034'].includes(error.code) || attempt === 2) throw error;
    }
  }
  if (result.alreadyMember) {
    const joinedServer = await prisma.server.findUnique({
      where: { id: result.serverId },
      select: serverSelect
    });

    return res.status(200).json(joinedServer);
  }

  return res.status(202).json({ message: 'Richiesta inviata. Il creatore del server deve accettarti.' });
};

const getServerInvite = async (req, res) => {
  if (!await canManageServer(req.user, req.params.id)) return res.status(403).json({ error: 'Permesso server richiesto' });
  const server = await prisma.server.findUnique({ where: { id: req.params.id }, select: {
    inviteCode: true, inviteExpiresAt: true, inviteMaxUses: true, inviteUses: true, inviteRevokedAt: true
  } });
  return res.json({ ...server, active: isInviteActive(server) });
};

const rotateServerInvite = async (req, res) => {
  if (!await canManageServer(req.user, req.params.id)) return res.status(403).json({ error: 'Permesso server richiesto' });
  const { expiresAt = null, maxUses = null } = req.body || {};
  const expiry = expiresAt === null ? null : new Date(expiresAt);
  if ((expiry && (!Number.isFinite(expiry.getTime()) || expiry <= new Date())) ||
      (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 100000))) {
    return res.status(400).json({ error: 'Scadenza o limite invito non valido' });
  }
  const updated = await prisma.server.update({ where: { id: req.params.id }, data: {
    inviteCode: await createUniqueInviteCode(), inviteExpiresAt: expiry,
    inviteMaxUses: maxUses, inviteUses: 0, inviteRevokedAt: null
  }, select: { inviteCode: true, inviteExpiresAt: true, inviteMaxUses: true, inviteUses: true } });
  return res.status(201).json({ ...updated, active: true });
};

const revokeServerInvite = async (req, res) => {
  if (!await canManageServer(req.user, req.params.id)) return res.status(403).json({ error: 'Permesso server richiesto' });
  await prisma.server.update({ where: { id: req.params.id }, data: { inviteRevokedAt: new Date() } });
  return res.json({ message: 'Invito revocato' });
};

const setDiscoverability = async (req, res) => {
  if (!await canManageServer(req.user, req.params.id)) return res.status(403).json({ error: 'Permesso server richiesto' });
  if (typeof req.body?.isDiscoverable !== 'boolean') return res.status(400).json({ error: 'Visibilità non valida' });
  const server = await prisma.server.update({ where: { id: req.params.id }, data: {
    isDiscoverable: req.body.isDiscoverable
  }, select: { id: true, isDiscoverable: true } });
  return res.json(server);
};

const getServer = async (req, res) => {
  const membership = await ensureServerMember(req.params.id, req.user.id);

  if (!membership) {
    return res.status(404).json({ error: 'Server non trovato' });
  }

  const server = await prisma.server.findUnique({
    where: { id: req.params.id },
    select: serverSelect
  });

  return res.status(200).json(server);
};

const joinServer = async (req, res) => {
  const server = await prisma.server.findFirst({
    where: {
      id: req.params.id,
      universityId: req.user.universityId,
      isDiscoverable: true
    },
    select: { id: true }
  });

  if (!server) {
    return res.status(404).json({ error: 'Server non trovato' });
  }

  const membership = await ensureServerMember(server.id, req.user.id);

  if (membership) {
    const joinedServer = await prisma.server.findUnique({
      where: { id: server.id },
      select: serverSelect
    });

    return res.status(200).json(joinedServer);
  }

  await prisma.serverJoinRequest.upsert({
    where: {
      userId_serverId: {
        userId: req.user.id,
        serverId: server.id
      }
    },
    update: { status: 'PENDING' },
    create: {
      userId: req.user.id,
      serverId: server.id
    }
  });

  return res.status(202).json({ message: 'Richiesta inviata. Il creatore del server deve accettarti.', serverId: server.id });
};

const acceptServerJoinRequest = async (req, res) => {
  const request = await prisma.serverJoinRequest.findUnique({
    where: { id: req.params.requestId },
    select: {
      id: true,
      userId: true,
      serverId: true,
      status: true,
      server: { select: { ownerId: true } }
    }
  });

  if (!request || request.status !== 'PENDING' || !await canManageServer(req.user, request.serverId)) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  const server = await prisma.$transaction(async (tx) => {
    await tx.serverMember.upsert({
      where: {
        userId_serverId: {
          userId: request.userId,
          serverId: request.serverId
        }
      },
      update: {},
      create: {
        userId: request.userId,
        serverId: request.serverId
      }
    });

    await tx.serverJoinRequest.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED' }
    });

    return tx.server.findUnique({
      where: { id: request.serverId },
      select: serverSelect
    });
  });

  return res.status(200).json(server);
};

const declineServerJoinRequest = async (req, res) => {
  const request = await prisma.serverJoinRequest.findUnique({
    where: { id: req.params.requestId },
    select: {
      id: true,
      serverId: true,
      status: true,
      server: { select: { ownerId: true } }
    }
  });

  if (!request || request.status !== 'PENDING' || !await canManageServer(req.user, request.serverId)) {
    return res.status(404).json({ error: 'Richiesta non trovata' });
  }

  await prisma.serverJoinRequest.update({
    where: { id: request.id },
    data: { status: 'DECLINED' }
  });

  return res.status(200).json({ message: 'Richiesta rifiutata' });
};

const deleteOrLeaveServer = async (req, res) => {
  const serverId = req.params.id;
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: {
      id: true,
      ownerId: true,
      members: {
        where: { userId: req.user.id },
        select: { id: true }
      }
    }
  });

  if (!server || server.members.length === 0) {
    return res.status(404).json({ error: 'Server non trovato' });
  }

  if (server.ownerId === req.user.id) {
    await prisma.$transaction([
      prisma.serverMember.deleteMany({
        where: { serverId }
      }),
      prisma.server.delete({
        where: { id: serverId }
      })
    ]);

    return res.status(200).json({ message: 'Server eliminato', action: 'deleted' });
  }

  await prisma.serverMember.delete({
    where: {
      userId_serverId: {
        userId: req.user.id,
        serverId
      }
    }
  });
  const sockets = await req.app.get('io')?.in(`user:${req.user.id}`).fetchSockets() || [];
  sockets.forEach((socket) => socket.disconnect(true));

  return res.status(200).json({ message: 'Sei uscito dal server', action: 'left' });
};

const createChannel = async (req, res) => {
  const { name, type = 'TEXT' } = req.body || {};
  const serverId = req.params.id;
  const membership = await canManageServer(req.user, serverId);

  if (!membership) {
    return res.status(403).json({ error: 'Permesso server richiesto' });
  }

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ error: 'Il nome del canale deve contenere almeno 2 caratteri' });
  }

  if (!['TEXT', 'VOICE'].includes(type)) {
    return res.status(400).json({ error: 'Tipo di canale non valido' });
  }

  const channel = await prisma.channel.create({
    data: {
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
      serverId
    }
  });

  return res.status(201).json(channel);
};

module.exports = {
  acceptServerJoinRequest,
  createChannel,
  createServer,
  declineServerJoinRequest,
  deleteOrLeaveServer,
  ensureServerMember,
  ensureServerOwner,
  getServer,
  getServerInvite,
  joinServer,
  joinServerByInvite,
  listServerJoinRequests,
  listAvailableServers,
  listServers,
  revokeServerInvite,
  rotateServerInvite,
  setDiscoverability
};
