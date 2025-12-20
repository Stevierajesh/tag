import { gameManager } from './game_engine/gameSessionManagement';


const { json } = require('express');
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

console.log("WebSocket server running on ws://localhost:8080");
server.on('connection', socket => {

    console.log('New client connected');
    socket.on('message', message => {
        console.log('Received from client: ', message.toString('utf8'));

        const data = JSON.parse(message);


        switch (data.type){
            case "CREATE_GAME":
                //function call here, that will start the game and have initial values sent
                gameManager.gameStart(data.playerID);
                break;
            case "JOIN_GAME":
                
                break;
            case "LOCATION_UPDATE":
                
                break;
            case "LEAVE_GAME":
                
                break;
            case "TAG_ATTEMPT":
                
                break;
            case "REVEAL_START":
                
                break;
            case "REVEAL_END":
                
                break;
            default:
                console.log("ERROR - UNKNOWN EVENT:" + data.type);
                break;
        }

    });

    socket.on('close', () => {

        //Must Add
        console.log('Client disconnected');
    });

});