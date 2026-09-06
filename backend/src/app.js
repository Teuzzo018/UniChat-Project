const cors = require('cors');
const express = require('express');
const path = require('path');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const apiRoutes = require('./routes');

const createApp = () => {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../frontend')));

  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
