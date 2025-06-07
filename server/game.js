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
  for (let i = 1; i < cards.length; i++) {
    if (compareRank(cards[i].rank, cards[i - 1].rank) !== 1) return false;
  }
  return true;
}

function isDoubleSequence(cards) {
  if (cards.length < 6 || cards.length % 2 !== 0) return false;
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
    this.passCount = 0; // number of consecutive passes
    this.lastPlayIndex = null; // index of player who last played
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
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].hand = deck.slice(i * 13, (i + 1) * 13);
      this.players[i].socket.emit('start', { hand: this.players[i].hand });
      this.players[i].socket.emit('hand', { hand: this.players[i].hand });
    }

    // determine starting player (lowest card)
    let lowPlayer = 0;
    let lowCard = this.players[0].hand[0];
    this.players.forEach((p, idx) => {
      p.hand.forEach(c => {
        if (cardCompare(c, lowCard) < 0) {
          lowCard = c;
          lowPlayer = idx;
        }
      });
    });

    // remove lowest card from that player's hand and start the pile
    const lpHand = this.players[lowPlayer].hand;
    const remIdx = lpHand.findIndex(c => c.rank === lowCard.rank && c.suit === lowCard.suit);
    lpHand.splice(remIdx, 1);
    this.currentSet = { cards: [lowCard], player: this.players[lowPlayer].name, type: 'single', highest: lowCard };
    this.lastPlayIndex = lowPlayer;
    this.turnIndex = (lowPlayer + 1) % this.players.length;
    this.passCount = 0;

    // send updated hand for starting player
    this.players[lowPlayer].socket.emit('hand', { hand: lpHand });
    this.broadcastState();
  }

  playCards(socket, cards) {
    const player = this.players.find(p => p.socket === socket);
    if (!player) return;
    if (!this.isPlayerTurn(player)) return;

    const play = this.validatePlay(cards);
    if (!play) {
      socket.emit('invalid');
      return;
    }

    const idx = this.players.indexOf(player);
    // remove cards from hand
    cards.forEach(card => {
      const i = player.hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
      if (i !== -1) player.hand.splice(i, 1);
    });
    player.socket.emit('hand', { hand: player.hand });

    this.currentSet = { cards: play.cards, player: player.name, type: play.type, highest: play.highest };
    this.lastPlayIndex = idx;
    this.passCount = 0;

    let nextIndex = (idx + 1) % this.players.length;

    if (player.hand.length === 0) {
      player.socket.emit('finished');
      this.players.splice(idx, 1);
      if (nextIndex > idx) nextIndex--;
      if (this.lastPlayIndex >= this.players.length) {
        this.lastPlayIndex = this.players.length ? this.lastPlayIndex % this.players.length : 0;
      }
    }

    if (this.players.length === 1) {
      this.endGame(this.players[0]);
      return;
    }

    this.turnIndex = nextIndex % this.players.length;
    this.broadcastState();
  }

  pass(socket) {
    const player = this.players.find(p => p.socket === socket);
    if (!player || !this.isPlayerTurn(player)) return;
    this.passCount++;
    const nextIndex = (this.turnIndex + 1) % this.players.length;

    if (!this.currentSet) {
      this.turnIndex = nextIndex;
      this.passCount = 0;
    } else if (this.passCount >= this.players.length - 1) {
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
    return this.players[this.turnIndex] === player;
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

  endGame(loser) {
    this.players.forEach(p => p.socket.emit('gameOver', { loser: loser.name }));
    this.players = [];
  }

  broadcastState() {
    const state = {
      players: this.players.map(p => ({name: p.name, handCount: p.hand.length})),
      currentTurn: this.players[this.turnIndex]?.name,
      lastPlay: this.currentSet
    };
    this.players.forEach(p => {
      p.socket.emit('state', state);
      p.socket.emit('hand', { hand: p.hand });
    });
  }
}

module.exports = Game;
