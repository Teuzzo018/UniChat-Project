const prisma = require('../lib/prisma');
const { ensureServerMember } = require('./serverControllers');

const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  channelId: true,
  user: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      role: true
    }
  }
};

const findAccessibleChannel = async (channelId, userId) => {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      type: true,
      serverId: true
    }
  });

  if (!channel) {
    return null;
  }

  const membership = await ensureServerMember(channel.serverId, userId);

  if (!membership) {
    return null;
  }

  return channel;
};

const listMessages = async (req, res) => {
  const channel = await findAccessibleChannel(req.params.channelId, req.user.id);

  if (!channel) {
    return res.status(404).json({ error: 'Canale non trovato' });
  }

  const messages = await prisma.message.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'asc' },
    take: 80,
    select: messageSelect
  });

  return res.status(200).json(messages);
};

const createMessage = async (req, res) => {
  const { content } = req.body;
  const channel = await findAccessibleChannel(req.params.channelId, req.user.id);

  if (!channel) {
    return res.status(404).json({ error: 'Canale non trovato' });
  }

  if (channel.type !== 'TEXT') {
    return res.status(400).json({ error: 'I messaggi sono disponibili solo nei canali testuali' });
  }

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Il messaggio non puo essere vuoto' });
  }

  const message = await prisma.message.create({
    data: {
      content: content.trim().slice(0, 1000),
      channelId: channel.id,
      userId: req.user.id
    },
    select: messageSelect
  });

  return res.status(201).json(message);
};

module.exports = {
  createMessage,
  findAccessibleChannel,
  listMessages,
  messageSelect
};
