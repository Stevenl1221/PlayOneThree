const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const game = new Game();

// Serve the built client in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('player connected', socket.id);

  socket.on('join', (name) => {
    game.addPlayer(socket, name);
  });

  socket.on('play', (cards) => {
    game.playCards(socket, cards);
  });

  socket.on('pass', () => {
    game.pass(socket);
  });

  socket.on('disconnect', () => {
    game.removePlayer(socket);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
