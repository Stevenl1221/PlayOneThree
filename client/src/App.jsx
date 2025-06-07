import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';

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

function triggerConfetti(player) {
  const el = document.getElementById(`player-${player}`);
  if (el) {
    const rect = el.getBoundingClientRect();
    confetti({
      particleCount: 150,
      spread: 70,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
    });
  } else {
    confetti({ particleCount: 150, spread: 70 });
  }
}

export default function App() {
  const [hand, setHand] = useState([]);
  const [state, setState] = useState(null);
  const [selected, setSelected] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [rankings, setRankings] = useState(null);
  const rankingsRef = useRef(rankings);
  const [lastWinner, setLastWinner] = useState(null);
  const lastWinnerRef = useRef(lastWinner);
  const [nameInput, setNameInput] = useState('');
  const [lobbies, setLobbies] = useState([]);
  const [currentLobby, setCurrentLobby] = useState(null);

  useEffect(() => {
    rankingsRef.current = rankings;
  }, [rankings]);

  useEffect(() => {
    lastWinnerRef.current = lastWinner;
  }, [lastWinner]);

  useEffect(() => {
    socket.on('nameSet', ({ name }) => {
      setPlayerName(name);
      socket.emit('listLobbies');
    });
    socket.on('lobbyList', setLobbies);
    socket.on('lobbyInfo', info => {
      setCurrentLobby(prev => {
        if (!info.started && prev && prev.hostId !== info.hostId && info.hostId === socket.id && rankingsRef.current)
          setRankings(null);
        return info;
      });
      if (!info.started) return;
      setRankings(null);
    });
    socket.on('start', ({ hand }) => {
      setRankings(null);
      setLastWinner(null);
      setHand(hand);
      setSelected([]);
    });
    socket.on('hand', ({ hand: newHand }) => {
      setHand(prev => {
        const updated = prev.filter(card =>
          newHand.some(c => c.rank === card.rank && c.suit === card.suit)
        );
        newHand.forEach(card => {
          if (!updated.some(c => c.rank === card.rank && c.suit === card.suit)) {
            updated.push(card);
          }
        });
        setSelected(sel => {
          const selectedCards = sel.map(i => prev[i]).filter(Boolean);
          return selectedCards.map(card =>
            updated.findIndex(c => c.rank === card.rank && c.suit === card.suit)
          );
        });
        return updated;
      });
    });
    socket.on('state', data => setState(data));
    socket.on('finished', ({ player }) => {
      if (!lastWinnerRef.current) {
        setLastWinner(player);
        triggerConfetti(player);
      }
    });
    socket.on('gameOver', ({ rankings }) => {
      setRankings(rankings);
      if (!lastWinnerRef.current && rankings?.length) {
        setLastWinner(rankings[0]);
      }
    });
    socket.on('returnToLobby', () => {
      setRankings(null);
      setState(null);
      setHand([]);
      setSelected([]);
    });
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

  const setName = () => {
    socket.emit('setName', nameInput.trim() || undefined);
  };

  const createLobby = () => {
    socket.emit('createLobby');
  };

  const joinLobby = (id) => {
    socket.emit('joinLobby', id);
  };

  const startGame = () => {
    socket.emit('startGame');
  };

  const leaveLobby = () => {
    socket.emit('leaveLobby');
    setCurrentLobby(null);
    setState(null);
    setHand([]);
    setSelected([]);
    setRankings(null);
    socket.emit('listLobbies');
  };

  const myTurn = state && state.currentTurn === playerName;

  if (rankings) {
    const rankStyles = ['text-xl font-bold', 'text-lg font-semibold', ''];
    return (
      <div className="container mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Game Over</h1>
        <div className="text-gray-600">You are: {playerName}</div>
        <ol className="list-decimal pl-4 space-y-1">
          {rankings.map((n, i) => (
            <li key={n} id={`player-${n}`} className={`flex items-center gap-2 ${rankStyles[i] || ''}`}>
              {i === 0 && (
                <span role="img" aria-label="winner" className="text-yellow-500">
                  👑
                </span>
              )}
              <span>{n}</span>
            </li>
          ))}
        </ol>
        {currentLobby && currentLobby.hostId === socket.id && (
          <button
            onClick={() => socket.emit('returnToLobby')}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Play Again
          </button>
        )}
        {currentLobby && (
          <button
            onClick={leaveLobby}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Leave Lobby
          </button>
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
            onClick={setName}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Confirm Name
          </button>
        </div>
      </div>
    );
  }

  if (!currentLobby) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Welcome, {playerName}</h1>
        <button
          onClick={createLobby}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Create Lobby
        </button>
        <div>
          <h2 className="font-semibold mb-2">Open Lobbies</h2>
          <ul className="space-y-2">
            {lobbies.map(l => (
              <li key={l.id} className="flex items-center gap-2">
                <span>
                  {l.hostName} ({l.players.length}/4) -{' '}
                  {l.started ? 'In game' : 'Waiting'}
                </span>
                <button
                  onClick={() => joinLobby(l.id)}
                  className="px-2 py-1 bg-blue-500 text-white rounded"
                >
                  {l.started ? 'Spectate' : 'Join'}
                </button>
              </li>
            ))}
            {lobbies.length === 0 && <li>No open lobbies</li>}
          </ul>
        </div>
      </div>
    );
  }

  if (currentLobby && !currentLobby.started) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Lobby</h1>
        <div className="text-gray-600">You are: {playerName}</div>
        <div>Players:</div>
        <ul className="list-disc pl-4 space-y-1">
          {currentLobby.players.map(n => (
            <li key={n} id={`player-${n}`} className="flex items-center gap-1">
              {lastWinner === n && (
                <span role="img" aria-label="winner" className="text-yellow-500">👑</span>
              )}
              <span>{n}</span>
            </li>
          ))}
        </ul>
        {currentLobby.hostId === socket.id ? (
          <button
            onClick={startGame}
            disabled={currentLobby.players.length < 2}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            Start Game
          </button>
        ) : (
          <div>Waiting for {currentLobby.hostName} to start the game...</div>
        )}
        <button
          onClick={leaveLobby}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Leave Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Thirteen Game</h1>
      <div className="text-gray-600 mb-2">You are: {playerName}</div>

      {state && (
        <div className="mb-4 space-y-2">
          <div>Current turn: {state.currentTurn}</div>
          <div className="flex gap-4">
            {state.players.map((p) => (
              <div key={p.name} id={`player-${p.name}`} className="flex items-center gap-1">
                {lastWinner === p.name && (
                  <span role="img" aria-label="winner" className="text-yellow-500">👑</span>
                )}
                <span>{p.name}: {p.handCount}</span>
              </div>
            ))}
          </div>
          {state.lastPlay && (
            <div>
              Last play: {state.lastPlay.player} -{' '}
              {state.lastPlay.cards.map((c, i) => (
                <span
                  key={i}
                  className={['d', 'h'].includes(c.suit) ? 'text-red-600 font-semibold' : 'text-black font-semibold'}
                >
                  {cardDisplay(c)}
                  {i < state.lastPlay.cards.length - 1 ? ' ' : ''}
                </span>
              ))}
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
      <button
        onClick={leaveLobby}
        className="fixed bottom-4 right-4 px-4 py-2 bg-red-500 text-white rounded"
      >
        Leave Lobby
      </button>
    </div>
  );
}
