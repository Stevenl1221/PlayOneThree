import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';

const socket = io(
  import.meta.env.PROD
    ? 'https://playonethree.onrender.com'
    : 'http://localhost:3001'
);

function cardDisplay(card) {
  const symbols = { c: '♣', d: '♦', h: '♥', s: '♠' };
  return card ? `${card.rank}${symbols[card.suit]}` : '';
}

function cardImageUrl(card) {
  if (!card) return '';
  const rankMap = {
    'A': 'ace',
    'K': 'king',
    'Q': 'queen',
    'J': 'jack',
    '10': '10',
    '9': '9',
    '8': '8',
    '7': '7',
    '6': '6',
    '5': '5',
    '4': '4',
    '3': '3',
    '2': '2',
  };
  const suitMap = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
  return `https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/png/${rankMap[card.rank]}_of_${suitMap[card.suit]}.png`;
}

const CARD_BACK = 'https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/png/back.png';

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h},65%,60%)`;
}

const RANK_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
// Suit order from weakest to strongest: spades < clubs < diamonds < hearts
const SUIT_ORDER = ['s','c','d','h'];

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
  const [hovered, setHovered] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [rankings, setRankings] = useState(null);
  const rankingsRef = useRef(rankings);
  const [lastWinner, setLastWinner] = useState(null);
  const lastWinnerRef = useRef(lastWinner);
  const [nameInput, setNameInput] = useState('');
  const [lobbies, setLobbies] = useState([]);
  const [currentLobby, setCurrentLobby] = useState(null);
  // Treat widths up to 430px (iPhone 13 Pro) as mobile
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 430);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 430);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const goToLobby = () => {
    setRankings(null);
    setState(null);
    setHand([]);
    setSelected([]);
  };

  const myTurn = state && state.currentTurn === playerName;

  const positionStyle = (pos) => {
    switch (pos) {
      case 'bottom':
        return 'bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center w-full px-4';
      case 'left':
        return 'left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-col items-center';
      case 'top':
        return 'top-2 sm:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center';
      case 'right':
        return 'right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center';
      default:
        return '';
    }
  };

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
        {currentLobby && currentLobby.hostId !== socket.id && (
          <button
            onClick={goToLobby}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Go to Lobby
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
    <div className="relative min-h-screen p-4 text-white overflow-hidden">
      <h1 className="text-3xl font-bold text-center mb-2">Thirteen Game</h1>
      <div className="text-center mb-4">
        <span className="inline-block bg-white/80 text-black px-2 py-1 rounded">
          Current turn: {state?.currentTurn}
        </span>
      </div>

      {state && (
        <>
        <div className="relative mx-auto w-full max-w-md sm:max-w-lg md:max-w-4xl h-[22rem] sm:h-[28rem] md:h-[32rem] rounded-full bg-gradient-to-b from-orange-600 via-red-500 to-orange-400 shadow-inner">
          <img src={CARD_BACK} alt="Deck" className="absolute w-16 left-4 top-1/2 -translate-y-1/2" />
          {state.lastPlay && (
            state.lastPlay.cards.slice(-4).map((c, i, arr) => (
              <img
                key={i}
                src={cardImageUrl(c)}
                alt={cardDisplay(c)}
                className="absolute w-16 bg-white rounded-sm"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%,-50%) rotate(${(i-(arr.length-1)/2)*10}deg) translateX(${(i-(arr.length-1)/2)*10}px)`
                }}
              />
            ))
          )}
          {state.players.map((p, idx) => {
            const myIndex = state.players.findIndex(pl => pl.name === playerName);
            const posIndex = (idx - myIndex + state.players.length) % state.players.length;
            const pos = ['bottom','left','top','right'][posIndex];
            return (
              <div key={p.name} id={`player-${p.name}`} className={`absolute ${positionStyle(pos)} text-black`}>
                {pos !== 'bottom' && (
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${myTurn && p.name === playerName ? 'glowing-turn' : ''}`}
                      style={{ backgroundColor: avatarColor(p.name) }}
                    >
                      {p.name.slice(0,1)}
                    </div>
                    <div className="relative mt-1">
                      <img
                        src={CARD_BACK}
                        alt=""
                        className={`${isMobile ? 'w-6' : 'w-12'}`}
                      />
                      <div className="absolute -top-2 -right-2 w-5 h-5 text-xs bg-yellow-400 rounded-full flex items-center justify-center">
                        {p.handCount}
                      </div>
                    </div>
                  </div>
                )}
                {pos === 'bottom' && (
                  <div className="relative h-40 sm:h-56 mt-2 flex items-end justify-center w-full z-20" style={{ perspective: '800px' }}>
                    {hand.map((c,i) => {
                      const angle = (i - (hand.length - 1) / 2) * 8;
                      const tilt = -angle * 0.3;
                      const spacing = isMobile ? 16 : 32;
                      const shift = (i - (hand.length - 1) / 2) * spacing;
                      const drop = Math.abs(angle) * 1.2;
                      const isSelected = selected.includes(i);
                      const isHovered = hovered === i;
                      const y = drop - (isSelected ? 32 : 0) - (isHovered ? 8 : 0);
                      return (
                        <motion.img
                          key={i}
                          src={cardImageUrl(c)}
                          alt={cardDisplay(c)}
                          onClick={() => toggleCard(i)}
                          onMouseEnter={() => setHovered(i)}
                          onMouseLeave={() => setHovered(null)}
                          className={`${isMobile ? 'w-16' : 'w-20 sm:w-24 md:w-28'} absolute transition-transform drop-shadow-lg cursor-pointer bottom-0 rounded-sm bg-white ${isSelected ? 'border-4 border-yellow-300' : ''}`}
                          style={{
                            transform: `translate(-50%, ${y}px) rotateY(${tilt}deg) rotate(${angle}deg)`,
                            left: `calc(50% + ${shift}px)`
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div
          className={`absolute z-30 ${isMobile ? 'left-1/2 -translate-x-1/2 bottom-36' : 'right-2 bottom-2'} flex flex-col items-center`}
        >
          <div className={`flex ${isMobile ? 'flex-row gap-2' : 'flex-row gap-2'}`}>
            <button
              onClick={playSelected}
              disabled={!myTurn || selected.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Play
            </button>
            <button
              onClick={pass}
              disabled={!myTurn}
              className="px-4 py-2 bg-gray-300 text-black rounded disabled:opacity-50"
            >
              Pass
            </button>
            <button
              onClick={sortHand}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              Sort
            </button>
          </div>
          <button
            onClick={leaveLobby}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
          >
            Leave
          </button>
        </div>
        </>
      )}
      {state && (
        <div className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 flex items-center gap-2 text-white">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold ${myTurn ? 'glowing-turn' : ''}`}
            style={{ backgroundColor: avatarColor(playerName) }}
          >
            {playerName.slice(0,1)}
          </div>
          <div className="leading-tight">
            <div className="font-semibold">{playerName}</div>
            <div className="text-sm">{hand.length} cards</div>
          </div>
        </div>
      )}
    </div>
  );
}
