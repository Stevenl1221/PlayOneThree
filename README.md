# PlayOneThree

This repository contains a simple multiplayer "Thirteen" card game with a separate server and client.

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

## Building the client for production
To create a production build of the client, run the following from the
`client` directory:

```bash
npm run build
```
The production files are generated in the `dist/` directory. You can preview the build locally with:

```bash
npm run preview
```

## Starting the server in production
The server does not require its own build step. After building the client, the
server will automatically serve the `dist` directory. From the `server`
directory run:

```bash
npm start
```
Use the `PORT` environment variable to change the listening port if needed.
Once the server is running you can access the game at
`http://localhost:3001` (or your chosen port).

