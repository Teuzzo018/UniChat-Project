const http = require('http');
const { Server } = require('socket.io');

const createApp = require('./app');
const env = require('./config/env');
const prisma = require('./lib/prisma');
const registerSocketHandlers = require('./sockets');

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.set('io', io);
registerSocketHandlers(io);

const closeServer = async (signal) => {
  console.log(`Ricevuto ${signal}. Chiusura del server in corso...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

server.listen(env.port, () => {
  console.log(`Server Express & Socket.io in esecuzione sulla porta ${env.port}`);
});
