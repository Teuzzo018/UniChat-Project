const prisma = require('../lib/prisma');
const { ensureServerMember } = require('./serverControllers');

const messageSelect = {
  id: true,
  content: true,
  attachmentUrl: true,
  attachmentName: true,
  attachmentMimeType: true,
  attachmentSize: true,
  createdAt: true,
  channelId: true,
  user: {
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      role: true
    }
  }
};

const privateMessageSelect = {
  id: true,
  content: true,
  attachmentUrl: true,
  attachmentName: true,
  attachmentMimeType: true,
  attachmentSize: true,
  createdAt: true,
  senderId: true,
  recipientId: true,
  sender: {
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      role: true
    }
  }
};

const getUploadedMessageInput = (req) => {
  const fields = req.upload?.fields || req.body || {};
  const file = req.upload?.file || null;
  const content = String(fields.content || '').trim().slice(0, 1000);

  return {
    content,
    file
  };
};

const getAttachmentData = (file) => {
  if (!file) {
    return {};
  }

  return {
    attachmentUrl: file.url,
    attachmentName: file.originalName,
    attachmentMimeType: file.mimeType,
    attachmentSize: file.size
  };
};

const getChannelRoom = (channelId) => `channel:${channelId}`;

const emitChannelMessage = (req, message) => {
  req.app.get('io')?.to(getChannelRoom(message.channelId)).emit('message_created', message);
};

const emitPrivateMessage = (req, message) => {
  const io = req.app.get('io');

  if (!io) {
    return;
  }

  io.to(`user:${message.senderId}`).emit('private_message_created', message);
  io.to(`user:${message.recipientId}`).emit('private_message_created', message);
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
  const { content, file } = getUploadedMessageInput(req);
  const channel = await findAccessibleChannel(req.params.channelId, req.user.id);

  if (!channel) {
    return res.status(404).json({ error: 'Canale non trovato' });
  }

  if (channel.type !== 'TEXT') {
    return res.status(400).json({ error: 'I messaggi sono disponibili solo nei canali testuali' });
  }

  if (!content && !file) {
    return res.status(400).json({ error: 'Il messaggio non puo essere vuoto' });
  }

  const message = await prisma.message.create({
    data: {
      content,
      ...getAttachmentData(file),
      channelId: channel.id,
      userId: req.user.id
    },
    select: messageSelect
  });

  emitChannelMessage(req, message);
  return res.status(201).json(message);
};

const ensurePrivateRecipient = async (currentUserId, recipientId) => {
  if (!recipientId || recipientId === currentUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: recipientId },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      role: true
    }
  });
};

const listPrivateMessages = async (req, res) => {
  const recipient = await ensurePrivateRecipient(req.user.id, req.params.userId);

  if (!recipient) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  const messages = await prisma.privateMessage.findMany({
    where: {
      OR: [
        { senderId: req.user.id, recipientId: recipient.id },
        { senderId: recipient.id, recipientId: req.user.id }
      ]
    },
    orderBy: { createdAt: 'asc' },
    take: 80,
    select: privateMessageSelect
  });

  return res.status(200).json(messages);
};

const listPrivateCalls = async (req, res) => {
  const recipient = await ensurePrivateRecipient(req.user.id, req.params.userId);

  if (!recipient) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  const calls = await prisma.privateCall.findMany({
    where: {
      OR: [
        { callerId: req.user.id, recipientId: recipient.id },
        { callerId: recipient.id, recipientId: req.user.id }
      ]
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      callerId: true,
      recipientId: true,
      status: true,
      startedAt: true,
      answeredAt: true,
      endedAt: true,
      caller: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true
        }
      },
      recipient: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true
        }
      }
    }
  });

  return res.status(200).json(calls);
};

const createPrivateMessage = async (req, res) => {
  const recipient = await ensurePrivateRecipient(req.user.id, req.params.userId);
  const { content, file } = getUploadedMessageInput(req);

  if (!recipient) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  if (!content && !file) {
    return res.status(400).json({ error: 'Il messaggio non puo essere vuoto' });
  }

  const message = await prisma.privateMessage.create({
    data: {
      content,
      ...getAttachmentData(file),
      senderId: req.user.id,
      recipientId: recipient.id
    },
    select: privateMessageSelect
  });

  emitPrivateMessage(req, message);
  return res.status(201).json(message);
};

module.exports = {
  createMessage,
  createPrivateMessage,
  findAccessibleChannel,
  listPrivateCalls,
  listMessages,
  listPrivateMessages,
  messageSelect
};
