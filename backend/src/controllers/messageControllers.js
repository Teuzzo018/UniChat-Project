const prisma = require('../lib/prisma');
const { ensureServerMember } = require('./serverControllers');
const { canModerateServerMessages } = require('../lib/authorization');
const { tombstoneChannelMessage, tombstonePrivateMessage } = require('../utils/messageDeletion');

const messageSelect = {
  id: true,
  content: true,
  attachmentUrl: true,
  attachmentName: true,
  attachmentMimeType: true,
  attachmentSize: true,
  deletedAt: true,
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
  deletedAt: true,
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

  req.uploadCommitted = true;

  emitChannelMessage(req, message);
  return res.status(201).json(message);
};

const deleteChannelMessage = async (req, res) => {
  const channel = await findAccessibleChannel(req.params.channelId, req.user.id);
  if (!channel) return res.status(404).json({ error: 'Messaggio non trovato' });
  const message = await prisma.message.findUnique({ where: { id: req.params.messageId }, select: {
    id: true, channelId: true, userId: true, attachmentUrl: true, deletedAt: true
  } });
  if (!message || message.channelId !== channel.id) return res.status(404).json({ error: 'Messaggio non trovato' });
  if (message.userId !== req.user.id && !await canModerateServerMessages(req.user, channel.serverId)) {
    return res.status(403).json({ error: 'Permesso messaggio richiesto' });
  }
  const result = await tombstoneChannelMessage(message, req.user.id);
  if (!result.alreadyDeleted) req.app.get('io')?.to(getChannelRoom(channel.id)).emit('message_deleted', {
    id: message.id, channelId: channel.id, deletedAt: result.deletedAt
  });
  return res.status(200).json({ message: 'Messaggio eliminato', ...result });
};

const deleteServerMessage = async (req, res) => {
  const message = await prisma.message.findUnique({
    where: { id: req.params.messageId },
    select: { id: true, channelId: true, attachmentUrl: true, deletedAt: true,
      channel: { select: { serverId: true } } }
  });
  if (!message || message.channel.serverId !== req.params.id) {
    return res.status(404).json({ error: 'Messaggio non trovato' });
  }
  if (!await canModerateServerMessages(req.user, req.params.id)) {
    return res.status(403).json({ error: 'Permesso server richiesto' });
  }
  const result = await tombstoneChannelMessage(message, req.user.id);
  if (!result.alreadyDeleted) req.app.get('io')?.to(getChannelRoom(message.channelId)).emit('message_deleted', {
    id: message.id, channelId: message.channelId, deletedAt: result.deletedAt
  });
  return res.status(200).json({ message: 'Messaggio eliminato', ...result });
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

const canContact = async (firstId, secondId) => {
  if (!firstId || !secondId || firstId === secondId) return false;
  const [friendship, block, target] = await Promise.all([
    prisma.friendship.findFirst({ where: { status: 'ACCEPTED', OR: [
      { requesterId: firstId, addresseeId: secondId },
      { requesterId: secondId, addresseeId: firstId }
    ] }, select: { id: true } }),
    prisma.blockedUser.findFirst({ where: { OR: [
      { blockerId: firstId, blockedId: secondId },
      { blockerId: secondId, blockedId: firstId }
    ] }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: secondId }, select: { id: true, suspendedAt: true } })
  ]);
  return Boolean(friendship && !block && target && !target.suspendedAt);
};

const listPrivateConversations = async (req, res) => {
  const userId = req.user.id;
  const [sentMessages, receivedMessages, outgoingCalls, incomingCalls] = await Promise.all([
    prisma.privateMessage.groupBy({ by: ['recipientId'], where: { senderId: userId }, _max: { createdAt: true } }),
    prisma.privateMessage.groupBy({ by: ['senderId'], where: { recipientId: userId }, _max: { createdAt: true } }),
    prisma.privateCall.groupBy({ by: ['recipientId'], where: { callerId: userId }, _max: { startedAt: true } }),
    prisma.privateCall.groupBy({ by: ['callerId'], where: { recipientId: userId }, _max: { startedAt: true } })
  ]);
  const latest = new Map();
  const record = (peerId, date) => {
    if (date && (!latest.has(peerId) || date > latest.get(peerId))) latest.set(peerId, date);
  };
  sentMessages.forEach((row) => record(row.recipientId, row._max.createdAt));
  receivedMessages.forEach((row) => record(row.senderId, row._max.createdAt));
  outgoingCalls.forEach((row) => record(row.recipientId, row._max.startedAt));
  incomingCalls.forEach((row) => record(row.callerId, row._max.startedAt));
  return res.status(200).json([...latest].sort((a, b) => b[1] - a[1])
    .map(([peerId, date]) => ({ userId: peerId, lastActivityAt: date })));
};

const listPrivateMessages = async (req, res) => {
  const recipient = await ensurePrivateRecipient(req.user.id, req.params.userId);

  if (!recipient) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  if (!await canContact(req.user.id, recipient.id)) {
    return res.status(404).json({ error: 'Conversazione non disponibile' });
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

const deletePrivateMessage = async (req, res) => {
  const recipient = await ensurePrivateRecipient(req.user.id, req.params.userId);
  if (!recipient) return res.status(404).json({ error: 'Messaggio non trovato' });
  if (!await canContact(req.user.id, recipient.id)) return res.status(404).json({ error: 'Conversazione non disponibile' });
  const message = await prisma.privateMessage.findUnique({ where: { id: req.params.messageId }, select: {
    id: true, senderId: true, recipientId: true, attachmentUrl: true, deletedAt: true
  } });
  if (!message || !(
    (message.senderId === req.user.id && message.recipientId === recipient.id) ||
    (message.senderId === recipient.id && message.recipientId === req.user.id)
  )) return res.status(404).json({ error: 'Messaggio non trovato' });
  if (message.senderId !== req.user.id) return res.status(403).json({ error: 'Solo l’autore può eliminare il messaggio privato' });
  const result = await tombstonePrivateMessage(message, req.user.id);
  if (!result.alreadyDeleted) {
    const payload = { id: message.id, senderId: message.senderId, recipientId: message.recipientId,
      deletedAt: result.deletedAt };
    const io = req.app.get('io');
    io?.to(`user:${message.senderId}`).emit('private_message_deleted', payload);
    io?.to(`user:${message.recipientId}`).emit('private_message_deleted', payload);
  }
  return res.status(200).json({ message: 'Messaggio eliminato', ...result });
};

const listPrivateCalls = async (req, res) => {
  const recipient = await ensurePrivateRecipient(req.user.id, req.params.userId);

  if (!recipient) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  if (!await canContact(req.user.id, recipient.id)) {
    return res.status(403).json({ error: 'Conversazione non disponibile' });
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

  if (!await canContact(req.user.id, recipient.id)) {
    return res.status(403).json({ error: 'Conversazione non disponibile' });
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

  req.uploadCommitted = true;

  emitPrivateMessage(req, message);
  return res.status(201).json(message);
};

module.exports = {
  deleteChannelMessage,
  deletePrivateMessage,
  createMessage,
  deleteServerMessage,
  createPrivateMessage,
  findAccessibleChannel,
  canContact,
  listPrivateCalls,
  listPrivateConversations,
  listMessages,
  listPrivateMessages,
  messageSelect
};
