const crypto = require('crypto');

const prisma = require('../lib/prisma');

const serverSelect = {
  id: true,
  name: true,
  description: true,
  inviteCode: true,
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
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          role: true
        }
      }
    }
  }
};

const createInviteCode = () => crypto.randomBytes(6).toString('hex');

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
      members: {
        none: {
          userId: req.user.id
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      owner: {
        select: {
          fullName: true
        }
      },
      _count: {
        select: {
          members: true
        }
      }
    }
  });

  return res.status(200).json(servers);
};

const createServer = async (req, res) => {
  const { name, description } = req.body;

  if (!req.user.universityId) {
    return res.status(400).json({ error: 'Per creare un server devi avere una università associata' });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Il nome del server deve contenere almeno 2 caratteri' });
  }

  const server = await prisma.server.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      inviteCode: await createUniqueInviteCode(),
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
  const inviteCode = String(req.body.inviteCode || '').trim();

  if (!inviteCode) {
    return res.status(400).json({ error: 'Codice invito mancante' });
  }

  const server = await prisma.server.findUnique({
    where: { inviteCode },
    select: { id: true }
  });

  if (!server) {
    return res.status(404).json({ error: 'Invito non valido' });
  }

  await prisma.serverMember.upsert({
    where: {
      userId_serverId: {
        userId: req.user.id,
        serverId: server.id
      }
    },
    update: {},
    create: {
      userId: req.user.id,
      serverId: server.id
    }
  });

  const joinedServer = await prisma.server.findUnique({
    where: { id: server.id },
    select: serverSelect
  });

  return res.status(200).json(joinedServer);
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
      universityId: req.user.universityId
    },
    select: { id: true }
  });

  if (!server) {
    return res.status(404).json({ error: 'Server non trovato' });
  }

  await prisma.serverMember.upsert({
    where: {
      userId_serverId: {
        userId: req.user.id,
        serverId: server.id
      }
    },
    update: {},
    create: {
      userId: req.user.id,
      serverId: server.id
    }
  });

  const joinedServer = await prisma.server.findUnique({
    where: { id: server.id },
    select: serverSelect
  });

  return res.status(200).json(joinedServer);
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

  return res.status(200).json({ message: 'Sei uscito dal server', action: 'left' });
};

const createChannel = async (req, res) => {
  const { name, type = 'TEXT' } = req.body;
  const serverId = req.params.id;
  const membership = await ensureServerMember(serverId, req.user.id);

  if (!membership) {
    return res.status(404).json({ error: 'Server non trovato' });
  }

  if (!name || name.trim().length < 2) {
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
  createChannel,
  createServer,
  deleteOrLeaveServer,
  ensureServerMember,
  getServer,
  joinServer,
  joinServerByInvite,
  listAvailableServers,
  listServers
};
