const prisma = require('../lib/prisma');
const { hashSessionToken } = require('../utils/sessionTokens');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token di autenticazione mancante'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Token non valido'
      });
    }

    const tokenHash = hashSessionToken(token);

    const session = await prisma.session.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: true
      }
    });

    if (!session) {
      return res.status(401).json({
        error: 'Sessione non valida'
      });
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({
        where: {
          id: session.id
        }
      });

      return res.status(401).json({
        error: 'Sessione scaduta'
      });
    }

    req.user = session.user;
    req.session = session;

    next();

  } catch (error) {
    console.error('Errore auth middleware:', error);

    return res.status(500).json({
      error: 'Errore durante l\'autenticazione'
    });
  }
};

module.exports = authMiddleware;
