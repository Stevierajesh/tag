process.on("uncaughtException", err => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled promise rejection:", err);
});

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

import fs from 'fs';


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
    "START_AR",
    "LOCAL_POSITIONS"
];

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.json());

import {
    gameManager,
    leaveGame,
    lookForGameWithPlayer,
    games,
    players,
    playerSockets,
    deleteGame,
    logBlockToggle
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
        socket.readyState === 1 ? 'OPEN' : 'CLOSED'
      ])
    )
  });
});


app.post('/deleteGame', (req, res) => {
  try {
    const { gameID } = req.body || {};

    if (!gameID) {
      return res.status(400).json({ error: 'Missing gameID' });
    }

    if (!games.has(gameID)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    deleteGame(gameID);//RECURSION ISSUE? 
    return res.status(200).json({ message: 'Game deleted' });
  } catch (err) {
    console.error('DeleteGame failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/logLocations', (req, res) => {
    try {
        const { locations } = req.body || {};

        if (!locations) {
            return res.status(400).json({ error: 'Missing locations' });
        }

        console.log('Logging locations:', locations);
        fs.appendFile(
            'locations_log.txt',
            JSON.stringify(locations, null, 2) + '\n',
            (err) => {
                if (err) {
                    console.error("Error appending to locations_log.txt:", err);
                }
            }
        );

        return res.status(200).json({ message: 'Locations logged' });
    } catch (err) {
        console.error('LogLocations failed:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/toggleLogBlock', (req, res) => {
    try {
        logBlockToggle();
        return res.status(200).json({ message: 'Log block toggled' });
    } catch (err) {
        console.error('ToggleLogBlock failed:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});



/* ---------------- WEBSOCKETS ---------------- */

wss.on('connection', socket => {
    console.log('WS client connected');

    socket.on('message', message => {
        let data;

        //console.log("Received message:", message.toString());

        try {
            data = JSON.parse(message.toString());
            if(data.type === "LOCATION_UPDATE" && data.playerID == "55B80020-6EE9-47F8-8171-3E0F94B5AC06"){
                console.log("LOCATION_UPDATE data:", data);
            }
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
        console.log('WS client disconnected');
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
