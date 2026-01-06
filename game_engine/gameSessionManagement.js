// In-memory storage for games - TO BE CACHED INTO REDIS LATER
import fs from 'fs';
export var games = new Map();

var gameTimers = new Map();

var hideTime = 0; //0 seconds
var seekTime = 10000 //10 seconds
var sendTime = 200; //0.5 seconds

var LOGBLOCKED = true;

export var players = new Map();
export var playerSockets = new Map();

function checkGameExists(gameID) {
    return games.has(gameID);
}

export function logBlockToggle() {
    LOGBLOCKED = false;
}

export function lookForGameWithPlayer(identification) {

    if (players.has(identification)) {
        //console.log("Found game for player: " + identification);
        let playerInfo = players.get(identification);
        return playerInfo.gameID;
    }

    return null;
}

function gameCreate(playerID, circleRadius, center, origin, socket) {
    if (lookForGameWithPlayer(playerID)) {
        console.log("ERROR: PLAYER ALREADY IN A GAME");
        return false;
    }
    let gameID = Math.random().toString(36).substring(2, 6);
    if (checkGameExists(gameID)) {
        while (checkGameExists(gameID)) {
            gameID = Math.random().toString(36).substring(2, 6);
        }
    }
    console.log("Game started by player: " + playerID);
    //Initialize game state
    const game = {
        gameID: gameID,
        Admin: playerID,
        phase: "LOBBY",
        players: [
            {
                playerID: playerID, status: "infected", isAdmin: true
            }
        ],
        origin: origin,
        circleCenter: center,
        circleRadius: circleRadius,
        timer: null,
        sendTimer: null,
    }

    gameTimers.set(gameID, {
        hideTimer: null,
        seekTimer: null,
        intervalTime: null,
        // future: shrinkInterval, revealInterval, etc.
    });

    players.set(playerID, { gameID: game.gameID, location: { lat: 0, lon: 0, alt: 0 }, origin: { x: 0, y: 0, z: 0 }, heading: null, gate: false, prevHeading: null});
    console.log("Adding Socket: " + socket);
    playerSockets.set(playerID, socket);
    games.set(game.gameID, game);
    return game;
}

export function deleteGame(gameID) {
    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }
    //delete ALL mentions of players
    for (const player of games.get(gameID).players) {
        playerSockets.delete(player.playerID);
        players.delete(player.playerID);
    }


    if (gameTimers.has(gameID)) {
        let timer = gameTimers.get(gameID);
        clearTimeout(timer.seekTimer);
        clearTimeout(timer.hideTimer);
        clearInterval(timer.intervalTime);
        gameTimers.delete(gameID);
    }

    games.delete(gameID);

    console.log(`Game: ${gameID} has been deleted`);
    return true;
}

export function leaveGame(gameID, playerID) {
    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

    let playersArray = games.get(gameID).players;
    playersArray = playersArray.filter(player => player.playerID != playerID);

    games.set(gameID, { ...games.get(gameID), players: playersArray });
    players.delete(playerID);
    playerSockets.delete(playerID);
    console.log(`Player: ${playerID} has left the game`);
    if (playersArray.length == 0) {
        deleteGame(gameID);
    }

    players.delete(playerID);
    return true;
}

function updateLocation(gameID, playerID, location) {
    try {
        if (checkGameExists(gameID) == false) {
            console.log("ERROR: GAME DOES NOT EXIST");
            return false;
        }
    } catch (error) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

    if (!players.has(playerID)) {
        return false;
    }
    let player = players.get(playerID);

    player.location = location;
    //console.log("Player Location: ", player.location);
    // player.heading = location.heading;  

    if (player.gate == false) {
        player.origin = location;
        player.gate = true;
    }
    players.set(playerID, { gameID: gameID, location: location, origin: player.origin, gate: player.gate, heading: location.heading, prevHeading: player.prevHeading});


    return true;
}

function getLocations(gameID) {
    if (!checkGameExists(gameID)) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

    const playersArray = games.get(gameID).players;
    const locations = {};

    for (let p of playersArray) {
        if (!players.has(p.playerID)) continue;

        const playerData = players.get(p.playerID);

        locations[p.playerID] = {
            playerID: p.playerID,
            location: playerData.location,
            origin: playerData.origin
        };
    }

    const payload = {
        type: "PLAYERS_UPDATE",
        locations,
        timestamp: Date.now()
    };

    for (let p of playersArray) {
        const socket = playerSockets.get(p.playerID);

        if (socket && socket.readyState === 1) {
            try {
                socket.send(JSON.stringify(payload));
                console.log("Payload:"+ JSON.stringify(payload));
            } catch (err) {
                console.error("Failed to send PLAYERS_UPDATE", err);
                playerSockets.delete(p.playerID);
                players.delete(p.playerID);
                leaveGame(lookForGameWithPlayer(p.playerID), p.playerID);
            }
        }
    }

    return locations;
}

function startSeekPhase(gameID) {
    if (!checkGameExists(gameID)) return false;

    const game = games.get(gameID);
    const gameTimer = gameTimers.get(gameID) ?? {};

    if (gameTimer.seekTimer) {
        clearTimeout(gameTimer.seekTimer);
    }

    if (gameTimer.intervalTime) {
        clearInterval(gameTimer.intervalTime);
    }

    game.phase = "SEEK";

    gameTimer.intervalTime = setInterval(() => {
        // action every 2 seconds
        getLocations(gameID);
        //console.log('sent');
    }, sendTime);


    gameTimer.seekTimer = setTimeout(() => {
        clearInterval(gameTimer.intervalTime);
        if (checkGameExists(gameID)) {
            startHidePhase(gameID);
        }
    }, seekTime);

    gameTimers.set(gameID, gameTimer);
    return true;
}

function startHidePhase(gameID) {
    if (!checkGameExists(gameID)) return false;
    const game = games.get(gameID);
    const gameTimer = gameTimers.get(gameID) ?? {};

    if (gameTimer.hideTimer) {
        clearTimeout(gameTimer.hideTimer);
    }

    game.phase = "HIDE";

    gameTimer.hideTimer = setTimeout(() => {
        if (checkGameExists(gameID)) {
            startSeekPhase(gameID);
        }
    }, hideTime);
    gameTimers.set(gameID, gameTimer);
    return true;
}

function gameStart(gameID) {
    console.log("Starting Game..." + gameID);
    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

    let game = games.get(gameID);
    game.phase = "HIDE";
    games.set(gameID, game);
    console.log(`Game: ${gameID} has started`);
    signalPlayersGameStart(gameID);
    //Wait here for 5 seconds to start hide phase
    setTimeout(() => {
        startHidePhase(gameID);
    }, 5000);
    return true;

}

function signalPlayersGameStart(gameID) {

    let game = games.get(gameID);
    game.players.forEach(player => {
        let playerSocket = playerSockets.get(player.playerID);
        if (playerSocket && playerSocket.readyState == 1) {
            try {
                playerSocket.send(JSON.stringify({ type: "GAME_STARTED", gameID: gameID }));
            } catch (err) {
                console.error("Failed To Send GAME_STARTED", err);
            }
        } else if (!playerSocket) {
            if (player.playerID) {
                console.error("Player socket missing:", player.playerID);
            } else {
                console.log("Player ID is missing");
            }
        } else {
            if (player.playerID) {
                console.error("Player socket not open:", player.playerID, playerSocket.readyState);
            } else {
                console.log("Player ID is missing");
            }
        }
    });
}

function signalPlayersGameEnd(gameID) {
    let game = games.get(gameID);
    game.players.forEach(player => {
        let playerSocket = playerSockets.get(player.playerID);
        if (playerSocket && playerSocket.readyState == 1) {
            try {
                playerSocket.send(JSON.stringify({ type: "GAME_ENDED", gameID: gameID }));
            } catch (err) {
                console.error("Failed To Send GAME_ENDED", err);
            }
        } else if (!playerSocket) {
            if (player.playerID) {
                console.error("Player socket missing:", player.playerID);
            } else {
                console.log("Player ID is missing");
            }
        } else {
            if (player.playerID) {
                console.error("Player socket not open:", player.playerID, playerSocket.readyState);
            } else {
                console.log("Player ID is missing");
            }
        }
    });
}

function joinGame(gameID, newplayerID, socket) {

    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

    if (lookForGameWithPlayer(newplayerID)) {
        console.log("ERROR: PLAYER ALREADY IN A GAME");
        return false;
    }

    let playersArray = games.get(gameID).players;
    //Saftey Check, Might remove, On Possiblity of Lifetime Player ID linked to account. 
    playersArray.forEach(player => {
        if (player.playerID == newplayerID) {
            return true;
        }
    });


    let player = {
        playerID: newplayerID,
        status: "running",
        isAdmin: false,
    }


    playersArray.push(player);


    games.set(gameID, { ...games.get(gameID), players: playersArray });
    players.set(newplayerID, { gameID: gameID, location: { lat: 0, lon: 0, alt: 0 }, origin: { x: 0, y: 0, z: 0 }, heading: null, gate: false , prevHeading: null});
    playerSockets.set(newplayerID, socket);
    console.log(`Player: ${newplayerID} has joined the game`);
    return true;
}

export function gameManager(data, socket) {

    let game = null;

    switch (data.type) {
        case "CREATE_GAME":
            //console.log("Origin: ", data.origin)
            game = gameCreate(data.playerID, data.circleRadius, data.circleCenter, data.origin, socket);
            if (game == false) {
                return { error: "player already in a game" };
            }
            games.set(game.gameID, game);
            console.log(`Game created with ID: ${game.gameID}`);
            return { type: "GAMEID", gameID: game.gameID };
        case "JOIN_GAME":
            //figure authentication
            let status = joinGame(data.gameID, data.playerID, socket);
            if (status == false) {
                return { error: "game does not exist" };
            }
            break;
        //     return joinGame(data.gameID, data.playerID);
        case "START_GAME":
            let gameID = lookForGameWithPlayer(data.playerID);
            console.log("starting game");

            gameStart(gameID, socket);
            break;
        case "LOCATION_UPDATE":
            //console.log("Player Location: ", data.location)
            const heading = data.location.heading;
            //console.log("Heading: ", heading);
            updateLocation(lookForGameWithPlayer(data.playerID), data.playerID, data.location);
            //block using the hide timer.
            //if(games.get(lookForGameWithPlayer(data.playerID)).block == false){
            //arPosCalculation(data.playerID)
            //}
            break;
        case "LEAVE_GAME":
            leaveGame(lookForGameWithPlayer(data.playerID), data.playerID);
            break;
        case "TAG_ATTEMPT":
            //Not Implemented Yet
            console.log(`Player: ${data.infectedPlayerID} attempted to tag Player: ${data.targetPlayerID}`);
            break;
        case "END_GAME":
            //Not Implemented Yet
            //console.log(`Game: ${data.gameID} has ended`);
            let gameID2 = lookForGameWithPlayer(data.playerID);
            if (gameID2) {
                signalPlayersGameEnd(gameID2);
                deleteGame(gameID2);
            } else {
                return { error: `Invalid event type: ${data.type}` };
            }
            break;
        case "START_AR":
            updateLocation(lookForGameWithPlayer(data.playerID), data.playerID, data.location)
            let player = players.get(data.playerID);
            if (player.prevHeading == null) {
                player.prevHeading = data.location.heading;
                players.set(data.playerID, { gameID: player.gameID, location: player.location, origin: player.origin, gate: player.gate, heading: player.heading, prevHeading: player.prevHeading });
            }
            // arPosCalculation(data.playerID, data.location.heading)
            break;
        case "END_AR":
            //let gameTimer = gameTimers.get(lookForGameWithPlayer(data.playerID));
            break;
        default:
            console.log("Invalid event type received: " + data.type);
            return { error: `Invalid event type: ${data.type}` };
    }
}






