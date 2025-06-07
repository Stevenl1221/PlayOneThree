class Card {
  constructor(rank, suit) {
    this.rank = rank; // 3..A,2
    this.suit = suit; // c,s,d,h
  }

  toString() {
    return this.rank + this.suit;
  }
}

const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUITS = ['c','s','d','h'];

function compareRank(a, b) {
  return RANKS.indexOf(a) - RANKS.indexOf(b);
}

function compareSuit(a, b) {
  return SUITS.indexOf(a) - SUITS.indexOf(b);
}

function createDeck() {
  const deck = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(new Card(r, s));
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardCompare(a, b) {
  const r = compareRank(a.rank, b.rank);
  return r !== 0 ? r : compareSuit(a.suit, b.suit);
}

function highestCard(cards) {
  return cards.reduce((h, c) => (cardCompare(c, h) > 0 ? c : h), cards[0]);
}

function isSequence(cards) {
  if (cards.length < 3) return false;
  if (cards.some(c => c.rank === '2')) return false;
  for (let i = 1; i < cards.length; i++) {
    if (compareRank(cards[i].rank, cards[i - 1].rank) !== 1) return false;
  }
  return true;
}

function isDoubleSequence(cards) {
  if (cards.length < 6 || cards.length % 2 !== 0) return false;
  if (cards.some(c => c.rank === '2')) return false;
  for (let i = 0; i < cards.length; i += 2) {
    if (cards[i].rank !== cards[i + 1].rank) return false;
    if (i >= 2 && compareRank(cards[i].rank, cards[i - 2].rank) !== 1) return false;
  }
  return true;
}

function analyseCards(cards) {
  const sorted = cards.slice().sort(cardCompare);
  const n = sorted.length;
  if (n === 1) {
    return { type: 'single', highest: sorted[0], cards: sorted };
  }
  if (n === 2 && sorted[0].rank === sorted[1].rank) {
    return { type: 'pair', highest: highestCard(sorted), cards: sorted };
  }
  if (n === 3 && sorted.every(c => c.rank === sorted[0].rank)) {
    return { type: 'triplet', highest: highestCard(sorted), cards: sorted };
  }
  if (n === 4 && sorted.every(c => c.rank === sorted[0].rank)) {
    return { type: 'quartet', highest: highestCard(sorted), cards: sorted };
  }
  if (isSequence(sorted)) {
    return { type: 'sequence', highest: sorted[sorted.length - 1], cards: sorted };
  }
  if (isDoubleSequence(sorted)) {
    return { type: 'doubleSequence', highest: sorted[sorted.length - 1], cards: sorted };
  }
  return null;
}

function isBomb(play, prev) {
  if (!prev || compareRank(prev.highest.rank, '2') !== 0) return false;

  if (prev.type === 'single') {
    if (play.type === 'quartet') return true;
    if (play.type === 'doubleSequence' && play.cards.length >= 6) return true;
  }

  if (prev.type === 'pair') {
    if (play.type === 'quartet') return true;
    if (play.type === 'doubleSequence' && play.cards.length >= 8) return true;
  }

  if (prev.type === 'triplet') {
    if (play.type === 'doubleSequence' && play.cards.length >= 10) return true;
  }

  return false;
}

class Player {
  constructor(socket, name, spectator = false) {
    this.socket = socket;
    this.name = name;
    this.hand = [];
    this.finished = false;
    this.spectator = spectator;
  }
}

class Game {
  constructor(autoStart = true) {
    this.players = [];
    this.activePlayers = [];
    this.turnIndex = 0;
    this.currentSet = null; // last played set
    this.pile = [];
    this.passCount = 0; // number of consecutive passes
    this.lastPlayIndex = null; // index of player who last played
    this.rankings = [];
    this.ready = new Set();
    this.gameActive = false;
    this.waitingForReady = false;
    this.autoStart = autoStart;
  }

  addPlayer(socket, name, spectator = false) {
    if (!spectator && this.players.filter(p => !p.spectator).length >= 4) return;
    const player = new Player(socket, name || `Player${this.players.length+1}`, spectator);
    this.players.push(player);
    socket.emit('joined', {name: player.name, spectator});
    this.broadcastState();
    if (!spectator && this.autoStart && !this.gameActive && !this.waitingForReady &&
        this.players.filter(p => !p.spectator).length >= 2) {
      this.start();
    }
  }

  removePlayer(socket) {
    const player = this.players.find(p => p.socket === socket);
    if (!player) return;
    this.players = this.players.filter(p => p.socket !== socket);
    const idx = this.activePlayers.indexOf(player);
    if (idx !== -1) {
      this.activePlayers.splice(idx, 1);
      if (this.turnIndex >= this.activePlayers.length) this.turnIndex = 0;
    }
    this.ready.delete(player.name);
    if (this.gameActive && this.activePlayers.length === 1) {
      this.rankings.push(this.activePlayers[0].name);
      this.endGame();
    } else {
      this.broadcastState();
      if (this.waitingForReady) this.broadcastReadyState();
    }
  }

  start() {
    const deck = shuffle(createDeck());
    this.rankings = [];
    this.ready.clear();
    this.gameActive = true;
    this.waitingForReady = false;

    let playerIndex = 0;
    for (const p of this.players) {
      if (p.spectator && playerIndex < 4) {
        p.spectator = false;
      }
      if (!p.spectator && playerIndex < 4) {
        p.hand = deck.slice(playerIndex * 13, (playerIndex + 1) * 13);
        p.finished = false;
        p.socket.emit('start', { hand: p.hand });
        p.socket.emit('hand', { hand: p.hand });
        playerIndex++;
      } else {
        p.hand = [];
        p.socket.emit('hand', { hand: p.hand });
      }
    }

    this.activePlayers = this.players.filter(p => !p.spectator).slice(0, 4);

    // determine starting player (lowest card)
    let lowPlayer = 0;
    let lowCard = this.activePlayers[0].hand[0];
    this.activePlayers.forEach((p, idx) => {
      p.hand.forEach(c => {
        if (cardCompare(c, lowCard) < 0) {
          lowCard = c;
          lowPlayer = idx;
        }
      });
    });

    // allow starting player to choose any combination, do not auto-play lowest card
    this.currentSet = null;
    this.lastPlayIndex = null;
    this.turnIndex = lowPlayer;
    this.passCount = 0;
    this.broadcastState();
  }

  playCards(socket, cards) {
    const player = this.players.find(p => p.socket === socket);
    if (!player || player.spectator) return;
    if (!this.isPlayerTurn(player)) return;

    const play = this.validatePlay(cards);
    if (!play) {
      socket.emit('invalid');
      return;
    }

    const idx = this.activePlayers.indexOf(player);
    // remove cards from hand
    cards.forEach(card => {
      const i = player.hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
      if (i !== -1) player.hand.splice(i, 1);
    });
    player.socket.emit('hand', { hand: player.hand });

    this.currentSet = { cards: play.cards, player: player.name, type: play.type, highest: play.highest };
    this.lastPlayIndex = idx;
    this.passCount = 0;

    let nextIndex = (idx + 1) % this.activePlayers.length;

    if (player.hand.length === 0) {
      player.finished = true;
      this.players.forEach(p => p.socket.emit('finished', { player: player.name }));
      this.rankings.push(player.name);
      this.activePlayers.splice(idx, 1);
      if (nextIndex > idx) nextIndex--;
      if (this.lastPlayIndex >= this.activePlayers.length) {
        this.lastPlayIndex = this.activePlayers.length ? this.lastPlayIndex % this.activePlayers.length : 0;
      }
    }

    if (this.activePlayers.length === 1) {
      this.rankings.push(this.activePlayers[0].name);
      this.endGame();
      return;
    }

    this.turnIndex = nextIndex % this.activePlayers.length;
    this.broadcastState();
  }

  pass(socket) {
    const player = this.players.find(p => p.socket === socket);
    if (!player || player.spectator || !this.isPlayerTurn(player)) return;
    this.passCount++;
    const nextIndex = (this.turnIndex + 1) % this.activePlayers.length;

    if (!this.currentSet) {
      this.turnIndex = nextIndex;
      this.passCount = 0;
    } else if (this.passCount >= this.activePlayers.length - 1) {
      // Everyone passed - clear current set and give turn to last winner
      this.currentSet = null;
      this.passCount = 0;
      this.turnIndex = this.lastPlayIndex;
    } else {
      this.turnIndex = nextIndex;
    }

    this.broadcastState();
  }

  isPlayerTurn(player) {
    return this.activePlayers[this.turnIndex] === player;
  }

  validatePlay(cards) {
    if (!cards || cards.length === 0) return null;
    const play = analyseCards(cards);
    if (!play) return null;
    if (!this.currentSet) return play;
    const prev = this.currentSet;
    if (play.type === prev.type && play.cards.length === prev.cards.length) {
      const r = compareRank(play.highest.rank, prev.highest.rank);
      if (r > 0) return play;
      if (r === 0 && compareSuit(play.highest.suit, prev.highest.suit) > 0) return play;
      return null;
    }
    if (isBomb(play, prev)) return play;
    return null;
  }

  endGame() {
    this.gameActive = false;
    this.waitingForReady = true;
    const rankings = this.rankings.slice();
    this.players.forEach(p => {
      p.socket.emit('gameOver', { rankings });
      p.hand = [];
      p.finished = false;
    });
    this.activePlayers = [];
    this.broadcastReadyState();
  }

  broadcastState() {
    const state = {
      players: this.players.map(p => ({name: p.name, handCount: p.hand.length})),
      currentTurn: this.activePlayers[this.turnIndex]?.name,
      lastPlay: this.currentSet
    };
    this.players.forEach(p => {
      p.socket.emit('state', state);
      p.socket.emit('hand', { hand: p.hand });
    });
  }

  broadcastReadyState() {
    const data = { ready: Array.from(this.ready) };
    this.players.forEach(p => p.socket.emit('readyState', data));
  }

  readyUp(socket) {
    if (!this.waitingForReady) return;
    const player = this.players.find(p => p.socket === socket);
    if (!player) return;
    this.ready.add(player.name);
    this.broadcastReadyState();
    if (this.ready.size === this.players.length) {
      this.start();
    }
  }
}

module.exports = Game;
