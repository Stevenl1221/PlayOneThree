import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

function cardDisplay(card) {
  const symbols = { c: '♣', d: '♦', h: '♥', s: '♠' };
  return card ? `${card.rank}${symbols[card.suit]}` : '';
}

const RANK_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUIT_ORDER = ['c','s','d','h'];

function cardCompare(a, b) {
  const r = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  return r !== 0 ? r : SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
}

export default function App() {
  const [hand, setHand] = useState([]);
  const [state, setState] = useState(null);
  const [selected, setSelected] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [rankings, setRankings] = useState(null);
  const [ready, setReady] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    socket.on('start', ({ hand }) => {
      setRankings(null);
      setReady([]);
      setHand(hand);
    });
    socket.on('hand', ({ hand }) => setHand(hand));
    socket.on('state', data => setState(data));
    socket.on('joined', ({ name }) => setPlayerName(name));
    socket.on('gameOver', ({ rankings }) => setRankings(rankings));
    socket.on('readyState', ({ ready }) => setReady(ready));
    return () => {
      socket.disconnect();
    };
  }, []);

  const toggleCard = (index) => {
    setSelected((sel) =>
      sel.includes(index) ? sel.filter((i) => i !== index) : [...sel, index]
    );
  };

  const playSelected = () => {
    const cards = selected.map((i) => hand[i]);
    if (cards.length > 0) {
      socket.emit('play', cards);
      setSelected([]);
    }
  };

  const readyUp = () => {
    socket.emit('ready');
  };

  const pass = () => {
    socket.emit('pass');
    setSelected([]);
  };

  const sortHand = () => {
    setHand(prev => {
      const sorted = [...prev].sort(cardCompare);
      setSelected(sel => {
        const selectedCards = sel.map(i => prev[i]);
        return selectedCards.map(card =>
          sorted.findIndex(c => c.rank === card.rank && c.suit === card.suit)
        );
      });
      return sorted;
    });
  };

  const joinGame = () => {
    socket.emit('join', nameInput.trim() || undefined);
    setHasJoined(true);
  };

  const myTurn = state && state.currentTurn === playerName;

  if (rankings) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Game Over</h1>
        <ol className="list-decimal pl-4">
          {rankings.map((n, i) => (
            <li key={n}>{i + 1}. {n}</li>
          ))}
        </ol>
        <button
          onClick={readyUp}
          disabled={ready.includes(playerName)}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Play Again
        </button>
        {ready.length < rankings.length && (
          <div>
            Waiting for: {rankings.filter(n => !ready.includes(n)).join(', ')}
          </div>
        )}
      </div>
    );
  }

  if (!playerName) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Thirteen Game</h1>
        <div className="space-y-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter your name"
            className="border rounded px-2 py-1"
          />
          <button
            onClick={joinGame}
            disabled={hasJoined}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Thirteen Game</h1>

      {state && (
        <div className="mb-4 space-y-2">
          <div>Current turn: {state.currentTurn}</div>
          <div className="flex gap-4">
            {state.players.map((p) => (
              <div key={p.name}>{p.name}: {p.handCount}</div>
            ))}
          </div>
          {state.lastPlay && (
            <div>
              Last play: {state.lastPlay.player} - {state.lastPlay.cards.map(cardDisplay).join(' ')}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {hand.map((c, i) => (
          <div
            key={i}
            onClick={() => toggleCard(i)}
            className={`w-12 h-16 border rounded flex items-center justify-center text-xl font-semibold cursor-pointer select-none
              ${['d','h'].includes(c.suit) ? 'text-red-600' : 'text-black'}
              ${selected.includes(i) ? 'bg-yellow-200 border-yellow-500 -translate-y-1' : 'bg-white'}`}
          >
            {cardDisplay(c)}
          </div>
        ))}
      </div>

      <div className="space-x-2">
        <button
          onClick={playSelected}
          disabled={!myTurn || selected.length === 0}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Play Selected
        </button>
        <button
          onClick={pass}
          disabled={!myTurn}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Pass
        </button>
        <button
          onClick={sortHand}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Sort Hand
        </button>
      </div>
    </div>
  );
}
