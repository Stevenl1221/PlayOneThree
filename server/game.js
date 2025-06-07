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

class Player {
  constructor(socket, name) {
    this.socket = socket;
    this.name = name;
    this.hand = [];
  }
}

class Game {
  constructor() {
    this.players = [];
    this.turnIndex = 0;
    this.currentSet = null; // last played set
    this.pile = [];
  }

  addPlayer(socket, name) {
    if (this.players.length >= 4) return;
    const player = new Player(socket, name || `Player${this.players.length+1}`);
    this.players.push(player);
    socket.emit('joined', {name: player.name});
    this.broadcastState();

    if (this.players.length >= 2) {
      this.start();
    }
  }

  removePlayer(socket) {
    this.players = this.players.filter(p => p.socket !== socket);
    this.broadcastState();
  }

  start() {
    const deck = shuffle(createDeck());
    for (let i=0;i<this.players.length;i++) {
      this.players[i].hand = deck.slice(i*13, (i+1)*13);
      this.players[i].socket.emit('start', {hand: this.players[i].hand});
    }
    this.turnIndex = 0;
    this.currentSet = null;
  }

  playCards(socket, cards) {
    const player = this.players.find(p => p.socket === socket);
    if (!player) return;
    // TODO: validate cards according to rules
    if (!this.isPlayerTurn(player)) return;
    if (!this.isValidPlay(cards)) {
      socket.emit('invalid');
      return;
    }

    // remove cards from hand
    cards.forEach(card => {
      const idx = player.hand.findIndex(c => c.rank===card.rank && c.suit===card.suit);
      if (idx !== -1) player.hand.splice(idx,1);
    });
    this.currentSet = {cards, player: player.name};
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.broadcastState();

    if (player.hand.length === 0) {
      this.endGame(player);
    }
  }

  pass(socket) {
    const player = this.players.find(p => p.socket === socket);
    if (!player || !this.isPlayerTurn(player)) return;
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.broadcastState();
  }

  isPlayerTurn(player) {
    return this.players[this.turnIndex] === player;
  }

  isValidPlay(cards) {
    if (!cards || cards.length === 0) return false;
    // Sort cards by rank then suit
    cards = cards.slice().sort((a,b)=>{
      const r = compareRank(a.rank,b.rank);
      return r !== 0 ? r : compareSuit(a.suit,b.suit);
    });

    if (!this.currentSet) return true; // first play of round

    // Simple comparison: only support single and pair for demo
    if (cards.length !== this.currentSet.cards.length) return false;

    const prev = this.currentSet.cards;

    if (cards.length === 1) {
      return compareRank(cards[0].rank, prev[0].rank) > 0 ||
        (cards[0].rank === prev[0].rank && compareSuit(cards[0].suit, prev[0].suit) > 0);
    }

    // pair comparison
    if (cards.length === 2 && cards[0].rank === cards[1].rank && prev[0].rank === prev[1].rank) {
      return compareRank(cards[0].rank, prev[0].rank) > 0;
    }

    return false;
  }

  endGame(winner) {
    this.players.forEach(p => p.socket.emit('gameOver', {winner: winner.name}));
    this.players = [];
  }

  broadcastState() {
    const state = {
      players: this.players.map(p => ({name: p.name, handCount: p.hand.length})),
      currentTurn: this.players[this.turnIndex]?.name,
      lastPlay: this.currentSet
    };
    this.players.forEach(p => p.socket.emit('state', state));
  }
}

module.exports = Game;
