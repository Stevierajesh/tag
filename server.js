const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

console.log("WebSocket server running on ws://localhost:8080");
//TEST CODE, NOT FOR PRODUCTION USE
server.on('connection', socket => {

    console.log('New client connected');
    socket.on('message', message => {
        console.log('Received from client: ', message.toString('utf8'));
        //socket.send(`Rojer That! ${message}`);
    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });

});