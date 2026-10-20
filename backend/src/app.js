const cors = require('cors');
const express = require('express');
const path = require('path');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const apiRoutes = require('./routes');
const { uploadRoot } = require('./utils/uploadParser');
const prisma = require('./lib/prisma');

const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/assets/vendor/livekit-client.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, '../node_modules/livekit-client/dist/livekit-client.umd.js'));
  });
  app.use(express.static(path.join(__dirname, '../../frontend')));
  // Solo gli avatar sono pubblici. Gli allegati passano da /api/uploads con sessione e permessi.
  app.get('/uploads/:filename', async (req, res, next) => {
    try {
      const filename = req.params.filename;
      if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename === '.' || filename === '..') {
        return res.status(404).end();
      }
      const avatar = await prisma.user.findFirst({ where: { avatarUrl: `/uploads/${filename}` }, select: { id: true } });
      if (!avatar) return res.status(404).end();
      if (!/\.(?:png|jpe?g|gif|webp)$/i.test(filename)) return res.status(404).end();
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Security-Policy', 'sandbox');
      return res.sendFile(path.join(uploadRoot, filename), (error) => {
        if (error && !res.headersSent) next(error);
      });
    } catch (error) { return next(error); }
  });

  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
