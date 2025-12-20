import { gameManager } from './game_engine/gameSessionManagement';


const { json } = require('express');
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });
const EVENTTYPES = ["CREATE_GAME", "JOIN_GAME", "LOCATION_UPDATE", "LEAVE_GAME", "TAG_ATTEMPT", "REVEAL_START", "REVEAL_END"];



console.log("WebSocket server running on ws://localhost:8080");
server.on('connection', socket => {

    console.log('New client connected');
    socket.on('message', message => {
        console.log('Received from client: ', message.toString('utf8'));

        const data = JSON.parse(message);

        if (EVENTTYPES.includes(data.eventType)) {
            const response = gameManager(data);
            socket.send(JSON.stringify(response));
        } else {
            console.log("Invalid event type received: " + data.eventType);
            socket.send(JSON.stringify({ error: "Invalid event type" }));
        }

    });

    socket.on('close', () => {

        //Must Add
        console.log('Client disconnected');
    });

});