process.on("uncaughtException", err => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled promise rejection:", err);
});

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

const EVENTTYPES = [
    "CREATE_GAME",
    "JOIN_GAME",
    "LOCATION_UPDATE",
    "LEAVE_GAME",
    "TAG_ATTEMPT",
    "START_GAME",
    "GET_LOCATIONS",
    "END_GAME",
    "SHOW_PLAYERS",
    "START_AR"
];

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });


import {
    gameManager,
    leaveGame,
    lookForGameWithPlayer,
    games,
    players,
    playerSockets,
    deleteGame
} from './game_engine/gameSessionManagement.js';

/* ---------------- DEBUG ROUTE ---------------- */
app.set('trust proxy', true);


app.get('/__debug/state', (req, res) => {

  res.json({
    games: Object.fromEntries(games),
    players: Object.fromEntries(players),
    playerSockets: Object.fromEntries(
      [...playerSockets].map(([id, socket]) => [
        id,
        socket.readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'
      ])
    )
  });
});


app.post('deleteGame', (req, res) => {
    const { gameID } = req.body;
    if (games.has(gameID)) {
        deleteGame(gameID);
        return res.status(200).json({ message: 'Game deleted' });
    } else {
        return res.status(404).json({ error: 'Game not found' });
    }
});



/* ---------------- WEBSOCKETS ---------------- */

wss.on('connection', socket => {
    console.log('WS client connected');

    socket.on('message', message => {
        let data;

        console.log("Received message:", message.toString());

        try {
            data = JSON.parse(message.toString());
        } catch {
            socket.send(JSON.stringify({ error: 'Invalid JSON' }));
            return;
        }

        if (!EVENTTYPES.includes(data.type)) {
            socket.send(JSON.stringify({ error: `Invalid event type: ${data.type}` }));
            return;
        }

        const response = gameManager(data, socket);
        if (response) {
            socket.send(JSON.stringify(response));
        }
    });

    socket.on('close', () => {
        for (const [playerID, s] of playerSockets) {
            if (s === socket) {
                leaveGame(lookForGameWithPlayer(playerID), playerID);
                console.log(`Cleaned up player ${playerID}`);
                break;
            }
        }
    });
});

/* ---------------- START ---------------- */


app.use(express.static('dashboard'));
server.listen(8080, () => {
    console.log('HTTP + WS server running on http://localhost:8080');
});
