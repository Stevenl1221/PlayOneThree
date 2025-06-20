# PlayOneThree

This repository contains a simple multiplayer "Thirteen" card game with a separate server and client.

## Gameplay Rules
- Standard "Thirteen" mechanics are implemented.
- Sequences may **not** include the rank `2`.

## Prerequisites
- [Node.js](https://nodejs.org/) (version 16 or later)
- npm (comes with Node.js)

## Installing dependencies
Install dependencies for both the server and the client:

```bash
# from the repository root
cd server && npm install
cd ../client && npm install
```

## Running the app in development
Start the server and client in two separate terminals:

```bash
# Terminal 1 - start the server
cd server
npm start
```
The server listens on **http://localhost:3001** by default.

```bash
# Terminal 2 - start the client
cd client
npm run dev
```
Vite will provide a local development URL (usually http://localhost:5173).
Open this URL in your browser and you'll be prompted to enter a name before
joining the lobby.

## Building the client for production
From the `client` directory, run:

```bash
npm run build
```
The production files are generated in the `dist/` directory. You can preview the build locally with:

```bash
npm run preview
```

## Starting the server in production
The server does not require a build step. From the `server` directory run:

```bash
npm start
```
Use the `PORT` environment variable to change the listening port if needed.

## Client/server URL

During development the client connects to `http://localhost:3001`. When you
build the client for production, it automatically uses

`https://playonethree.onrender.com` as the Socket.IO server URL. The hosted
client is available at `https://playonethree-1.onrender.com`. If you deploy the
server somewhere else, edit `client/src/App.jsx` to point at your server.
