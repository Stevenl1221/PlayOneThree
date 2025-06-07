import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

export default function App() {
  const [hand, setHand] = useState([]);
  const [state, setState] = useState(null);

  useEffect(() => {
    socket.on('start', ({hand}) => setHand(hand));
    socket.on('state', data => setState(data));
    socket.on('joined', () => console.log('joined game'));
    socket.emit('join');
    return () => {
      socket.disconnect();
    }
  }, []);

  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-bold mb-4">Thirteen Game</h1>
      {state && (
        <div className="mb-2">Current turn: {state.currentTurn}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {hand.map((c,i) => (
          <div key={i} className="border p-2 bg-white">{c.rank}{c.suit}</div>
        ))}
      </div>
    </div>
  );
}
