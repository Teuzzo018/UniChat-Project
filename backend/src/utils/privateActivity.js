const prisma = require('../lib/prisma');

const recordPrivateActivity = async ({ io, senderId, recipientId, activityKey, kind, content }) => {
  try {
    const message = await prisma.privateMessage.create({
      data: { senderId, recipientId, activityKey, kind, content },
      select: {
        id: true, content: true, kind: true, createdAt: true, senderId: true, recipientId: true,
        sender: { select: { id: true, username: true, fullName: true, avatarUrl: true, role: true } }
      }
    });
    io.to(`user:${senderId}`).emit('private_message_created', message);
    io.to(`user:${recipientId}`).emit('private_message_created', message);
    return message;
  } catch (error) {
    if (error.code !== 'P2002') console.error('Attività privata non salvata:', error.code || error.name);
    return null;
  }
};

module.exports = { recordPrivateActivity };
