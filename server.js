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
    "END_GAME"
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
    playerSockets
} from './game_engine/gameSessionManagement.js';

/* ---------------- DEBUG ROUTE ---------------- */

app.get('/__debug/state', (req, res) => {

    if (req.socket.remoteAddress !== '127.0.0.1' &&
        req.socket.remoteAddress !== '::1') {
        return res.status(403).end();
    }

    // if (!socket) {
    //     console.log("Missing socket for player:");
    // }
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
