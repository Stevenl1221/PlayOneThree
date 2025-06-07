const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const lobbies = new Map();

function lobbyList() {
  return Array.from(lobbies.values()).map(l => ({
    id: l.id,
    hostName: l.hostName,
    players: l.game.players.map(p => p.name),
    started: l.game.gameActive
  }));
}

function broadcastLobbyList() {
  io.emit('lobbyList', lobbyList());
}

function updateLobbyInfo(lobby) {
  const data = {
    id: lobby.id,
    hostId: lobby.host,
    hostName: lobby.hostName,
    players: lobby.game.players.map(p => p.name),
    started: lobby.game.gameActive
  };
  lobby.game.players.forEach(p => p.socket.emit('lobbyInfo', data));
}

io.on('connection', socket => {
  console.log('player connected', socket.id);

  socket.on('setName', name => {
    socket.data.name = name || 'Player';
    socket.emit('nameSet', { name: socket.data.name });
    broadcastLobbyList();
  });

  socket.on('listLobbies', () => {
    socket.emit('lobbyList', lobbyList());
  });

  socket.on('createLobby', () => {
    if (!socket.data.name) return;
    const id = Math.random().toString(36).slice(2, 8);
    const lobby = {
      id,
      host: socket.id,
      hostName: socket.data.name,
      game: new Game(false)
    };
    lobbies.set(id, lobby);
    lobby.game.addPlayer(socket, socket.data.name);
    socket.data.lobbyId = id;
    broadcastLobbyList();
    updateLobbyInfo(lobby);
  });

  socket.on('joinLobby', id => {
    const lobby = lobbies.get(id);
    if (!lobby) return;
    if (lobby.game.gameActive) {
      lobby.game.addPlayer(socket, socket.data.name, true);
    } else {
      if (lobby.game.players.filter(p => !p.spectator).length >= 4) return;
      lobby.game.addPlayer(socket, socket.data.name);
    }
    socket.data.lobbyId = id;
    broadcastLobbyList();
    updateLobbyInfo(lobby);
  });

  socket.on('startGame', () => {
    const lobby = lobbies.get(socket.data.lobbyId);
    if (!lobby) return;
    if (lobby.host !== socket.id) return;
    if (!lobby.game.gameActive && lobby.game.players.length >= 2) {
      lobby.game.start();
      broadcastLobbyList();
      updateLobbyInfo(lobby);
    }
  });

  socket.on('returnToLobby', () => {
    const lobby = lobbies.get(socket.data.lobbyId);
    if (!lobby) return;
    if (lobby.host !== socket.id) return;
    if (!lobby.game.gameActive && !lobby.game.waitingForReady) return;
    lobby.game.waitingForReady = false;
    lobby.game.ready.clear();
    lobby.game.rankings = [];
    lobby.game.gameActive = false;
    broadcastLobbyList();
    updateLobbyInfo(lobby);
    lobby.game.players.forEach(p => p.socket.emit('returnToLobby'));
  });

  socket.on('play', cards => {
    const lobby = lobbies.get(socket.data.lobbyId);
    if (lobby) lobby.game.playCards(socket, cards);
  });

  socket.on('pass', () => {
    const lobby = lobbies.get(socket.data.lobbyId);
    if (lobby) lobby.game.pass(socket);
  });

  socket.on('ready', () => {
    const lobby = lobbies.get(socket.data.lobbyId);
    if (lobby) lobby.game.readyUp(socket);
  });

  socket.on('leaveLobby', () => {
    const id = socket.data.lobbyId;
    if (!id) return;
    const lobby = lobbies.get(id);
    if (!lobby) return;
    lobby.game.removePlayer(socket);
    socket.data.lobbyId = null;
    if (lobby.host === socket.id) {
      if (lobby.game.players.length > 0) {
        lobby.host = lobby.game.players[0].socket.id;
        lobby.hostName = lobby.game.players[0].name;
      } else {
        lobbies.delete(id);
        broadcastLobbyList();
        return;
      }
    }
    if (lobby.game.players.length === 0) {
      lobbies.delete(id);
    }
    broadcastLobbyList();
    if (lobbies.has(id)) updateLobbyInfo(lobby);
  });

  socket.on('disconnect', () => {
    const id = socket.data.lobbyId;
    if (!id) return;
    const lobby = lobbies.get(id);
    if (!lobby) return;
    lobby.game.removePlayer(socket);
    if (lobby.host === socket.id) {
      if (lobby.game.players.length > 0) {
        lobby.host = lobby.game.players[0].socket.id;
        lobby.hostName = lobby.game.players[0].name;
      } else {
        lobbies.delete(id);
        broadcastLobbyList();
        return;
      }
    }
    if (lobby.game.players.length === 0) {
      lobbies.delete(id);
    }
    broadcastLobbyList();
    updateLobbyInfo(lobby);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

