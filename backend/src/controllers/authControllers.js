const bcrypt = require('bcryptjs');

const env = require('../config/env');
const prisma = require('../lib/prisma');
const { createSessionToken, hashSessionToken } = require('../utils/sessionTokens');
const { registrationRole } = require('../lib/bootstrap');
const { SITE_OWNER_EMAIL } = require('../lib/authorization');
const disconnectUserSockets = require('../utils/disconnectUserSockets');
const { parseInviteCode, isInviteActive, redeemInvite } = require('../utils/serverInvites');

const userSelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  suspendedAt: true,
  universityId: true,
  createdAt: true
};

const normalizeUsername = (value) => {
  return String(value || '').trim().toLowerCase();
};

const isValidEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizeOptionalUrl = (value) => {
  const trimmedValue = String(value || '').trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    return url.toString();
  } catch {
    return false;
  }
};

const register = async (req, res) => {
  try {
    const fields = req.upload?.fields || req.body || {};
    const uploadedFile = req.upload?.file || null;
    const { email, password, fullName, universityId, inviteCode } = fields;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const ownerRegistration = normalizedEmail === SITE_OWNER_EMAIL;
    const username = normalizeUsername(fields.username);
    const avatarUrl = normalizeOptionalUrl(fields.avatarUrl);

    if (!email || !password || !fullName || !username) {
      return res.status(400).json({
        error: 'Username, email, password e nome completo sono obbligatori'
      });
    }

    if (!isValidEmail(email) || typeof password !== 'string' || password.length < 12 || password.length > 128 || typeof fullName !== 'string' || fullName.trim().length > 100) {
      return res.status(400).json({ error: 'Email, password o nome non validi (password: 12-128 caratteri)' });
    }
    if (uploadedFile && (!uploadedFile.mimeType?.startsWith('image/') || !/\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(uploadedFile.originalName))) {
      return res.status(400).json({ error: 'Il file profilo deve essere un\'immagine' });
    }

    if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
      return res.status(400).json({
        error: 'Username non valido: usa 3-24 caratteri tra lettere, numeri, punto, trattino e underscore'
      });
    }

    if (avatarUrl === false) {
      return res.status(400).json({
        error: 'URL immagine profilo non valido'
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email già registrata'
      });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      return res.status(409).json({
        error: 'Username già in uso'
      });
    }

    let university = null;
    let invitedServer = null;

    const normalizedInvite = inviteCode ? parseInviteCode(inviteCode) : null;
    if (inviteCode && !normalizedInvite) return res.status(404).json({ error: 'Invito non valido' });
    if (normalizedInvite) {
      invitedServer = await prisma.server.findUnique({
        where: { inviteCode: normalizedInvite },
        select: { id: true, universityId: true, inviteExpiresAt: true,
          inviteMaxUses: true, inviteUses: true, inviteRevokedAt: true }
      });
      if (!isInviteActive(invitedServer)) return res.status(404).json({ error: 'Invito non valido' });
    } else if (universityId) {
      university = await prisma.university.findUnique({
        where: { id: universityId }
      });

      if (!university) {
        return res.status(404).json({
          error: 'Università non trovata'
        });
      }
    } else if (!ownerRegistration) {
      return res.status(400).json({
        error: 'Se non usi un invito, devi scegliere una università'
      });
    }

    const passwordHash = await bcrypt.hash(password, env.saltRounds);

    let demotedUserIds = [];
    const user = await prisma.$transaction(async (tx) => {
      const role = await registrationRole(tx, normalizedEmail);
      if (role !== 'SUPERADMIN' && !university && !invitedServer) {
        const error = new Error('Devi scegliere una università');
        error.statusCode = 409;
        throw error;
      }
      if (role === 'SUPERADMIN') {
        const oldSuperadmins = await tx.user.findMany({ where: { role: 'SUPERADMIN' }, select: { id: true } });
        demotedUserIds = oldSuperadmins.map(({ id }) => id);
        if (demotedUserIds.length) {
          await tx.user.updateMany({ where: { id: { in: demotedUserIds } }, data: { role: 'STUDENT' } });
          await tx.session.deleteMany({ where: { userId: { in: demotedUserIds } } });
        }
      }
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          username,
          passwordHash,
          fullName: fullName.trim(),
          avatarUrl: uploadedFile?.url || avatarUrl,
          universityId: university?.id || invitedServer?.universityId || null,
          role
        },
        select: userSelect
      });

      if (invitedServer) {
        await redeemInvite(tx, normalizedInvite, createdUser.id);
      }

      return createdUser;
    });
    await Promise.all(demotedUserIds.map(async (id) => {
      try {
        await disconnectUserSockets(req.app, id);
      } catch (error) {
        console.error('Errore disconnessione superadmin precedente:', error);
      }
    }));

    return res.status(201).json({
      message: 'Utente registrato con successo',
      user
    });

  } catch (error) {
    console.error('Errore register:', error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Errore durante la registrazione'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Email e password sono obbligatorie'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Email o password non corretti'
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: 'Email o password non corretti'
      });
    }

    if (user.suspendedAt) return res.status(403).json({ error: 'Account sospeso' });

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() + env.sessionDurationDays
    );

    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt
      }
    });

    return res.status(200).json({
      message: 'Login effettuato con successo',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        suspendedAt: user.suspendedAt,
        universityId: user.universityId
      }
    });

  } catch (error) {
    console.error('Errore login:', error);

    return res.status(500).json({
      error: 'Errore durante il login'
    });
  }
};

const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token mancante'
      });
    }

    const token = authHeader.split(' ')[1];

    const tokenHash = hashSessionToken(token);

    await prisma.session.deleteMany({
      where: {
        tokenHash
      }
    });
    const sockets = await req.app.get('io')?.fetchSockets() || [];
    sockets.filter((socket) => socket.data.token === token).forEach((socket) => socket.disconnect(true));

    return res.status(200).json({
      message: 'Logout effettuato con successo'
    });

  } catch (error) {
    console.error('Errore logout:', error);

    return res.status(500).json({
      error: 'Errore durante il logout'
    });
  }
};

const getAuthenticatedUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      },
      select: userSelect
    });

    if (!user) {
      return res.status(404).json({
        error: 'Utente non trovato'
      });
    }

    return res.status(200).json(user);

  } catch (error) {
    console.error('Errore me:', error);

    return res.status(500).json({
      error: 'Errore nel recupero dell\'utente'
    });
  }
};

const updateAuthenticatedUser = async (req, res) => {
  try {
    const fields = req.upload?.fields || req.body || {};
    const uploadedFile = req.upload?.file || null;
    const fullName = String(fields.fullName || '').trim();
    const avatarUrl = normalizeOptionalUrl(fields.avatarUrl);

    if (!fullName) {
      return res.status(400).json({
        error: 'Nome completo obbligatorio'
      });
    }

    if (uploadedFile && !uploadedFile.mimeType?.startsWith('image/')) {
      return res.status(400).json({
        error: 'Il file profilo deve essere un\'immagine'
      });
    }

    if (avatarUrl === false) {
      return res.status(400).json({
        error: 'URL immagine profilo non valido'
      });
    }

    if (uploadedFile && !uploadedFile.mimeType?.startsWith('image/')) {
      return res.status(400).json({
        error: 'Il file profilo deve essere un\'immagine'
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName,
        avatarUrl: uploadedFile?.url || avatarUrl || req.user.avatarUrl
      },
      select: userSelect
    });

    return res.status(200).json(user);
  } catch (error) {
    console.error('Errore update me:', error);

    return res.status(500).json({
      error: 'Errore durante l\'aggiornamento del profilo'
    });
  }
};


module.exports = {
  register,
  login,
  logout,
  getAuthenticatedUser,
  updateAuthenticatedUser,
};
