const prisma = require('../lib/prisma');

const listOverview = async (req, res) => {
  const [users, servers, messages] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        university: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.server.findMany({
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
        university: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            members: true,
            channels: true
          }
        }
      }
    }),
    prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: {
          select: {
            fullName: true
          }
        },
        channel: {
          select: {
            name: true,
            server: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })
  ]);

  return res.status(200).json({ users, servers, messages });
};

const deleteMessage = async (req, res) => {
  await prisma.message.delete({
    where: { id: req.params.id }
  });

  return res.status(200).json({ message: 'Messaggio eliminato' });
};

const deleteServer = async (req, res) => {
  await prisma.$transaction([
    prisma.serverMember.deleteMany({
      where: { serverId: req.params.id }
    }),
    prisma.server.delete({
      where: { id: req.params.id }
    })
  ]);

  return res.status(200).json({ message: 'Server eliminato' });
};

const deleteUser = async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Non puoi eliminare il tuo account admin da qui' });
  }

  const ownedServers = await prisma.server.findMany({
    where: { ownerId: req.params.id },
    select: { id: true }
  });
  const ownedServerIds = ownedServers.map((server) => server.id);

  await prisma.$transaction([
    prisma.session.deleteMany({
      where: { userId: req.params.id }
    }),
    prisma.message.deleteMany({
      where: { userId: req.params.id }
    }),
    prisma.serverMember.deleteMany({
      where: {
        OR: [
          { userId: req.params.id },
          { serverId: { in: ownedServerIds } }
        ]
      }
    }),
    prisma.server.deleteMany({
      where: { id: { in: ownedServerIds } }
    }),
    prisma.user.delete({
      where: { id: req.params.id }
    })
  ]);

  return res.status(200).json({ message: 'Utente eliminato' });
};

module.exports = {
  deleteMessage,
  deleteServer,
  deleteUser,
  listOverview
};
