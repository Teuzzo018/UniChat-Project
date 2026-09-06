const bcrypt = require('bcryptjs');

const env = require('../config/env');
const prisma = require('../lib/prisma');
const { createSessionToken, hashSessionToken } = require('../utils/sessionTokens');

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  universityId: true,
  createdAt: true
};

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
    const { email, password, fullName, universityId, inviteCode, adminCode } = req.body;
    const avatarUrl = normalizeOptionalUrl(req.body.avatarUrl);

    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Email, password e nome completo sono obbligatori'
      });
    }

    if (avatarUrl === false) {
      return res.status(400).json({
        error: 'URL immagine profilo non valido'
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email già registrata'
      });
    }

    let university = null;
    let invitedServer = null;

    if (universityId) {
      university = await prisma.university.findUnique({
        where: { id: universityId }
      });

      if (!university) {
        return res.status(404).json({
          error: 'Università non trovata'
        });
      }
    } else if (inviteCode) {
      invitedServer = await prisma.server.findUnique({
        where: { inviteCode: String(inviteCode).trim() },
        select: { id: true }
      });

      if (!invitedServer) {
        return res.status(404).json({
          error: 'Invito non valido'
        });
      }
    } else {
      return res.status(400).json({
        error: 'Se non usi un invito, devi scegliere una università'
      });
    }

    const passwordHash = await bcrypt.hash(password, env.saltRounds);
    const role = env.adminSetupCode && adminCode === env.adminSetupCode ? 'ADMIN' : 'STUDENT';

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          avatarUrl,
          universityId: university?.id || null,
          role
        },
        select: userSelect
      });

      if (invitedServer) {
        await tx.serverMember.create({
          data: {
            userId: createdUser.id,
            serverId: invitedServer.id
          }
        });
      }

      return createdUser;
    });

    return res.status(201).json({
      message: 'Utente registrato con successo',
      user
    });

  } catch (error) {
    console.error('Errore register:', error);

    return res.status(500).json({
      error: 'Errore durante la registrazione'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e password sono obbligatorie'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
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
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
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


module.exports = {
  register,
  login,
  logout,
  getAuthenticatedUser
};
