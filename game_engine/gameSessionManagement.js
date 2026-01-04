// In-memory storage for games - TO BE CACHED INTO REDIS LATER
import fs from 'fs';
export var games = new Map();

var gameTimers = new Map();

var hideTime = 0; //10 seconds
var seekTime = 10000 //10 seconds
var sendTime = 200; //0.5 seconds
var arTime = 30000; // 30 seconds

export var players = new Map();
export var playerSockets = new Map();

function checkGameExists(gameID) {
    return games.has(gameID);
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
    if(lookForGameWithPlayer(playerID)){
        console.log("ERROR: PLAYER ALREADY IN A GAME");
        return false;
    }
    let gameID = Math.random().toString(36).substring(2, 6);
    if(checkGameExists(gameID)){
        while(checkGameExists(gameID)){
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
        sendTimer: null
    }

    gameTimers.set(gameID, {
        hideTimer: null,
        seekTimer: null,
        intervalTime: null
        // future: shrinkInterval, revealInterval, etc.
    });

    players.set(playerID, { gameID: game.gameID, location: { y: 0, x: 0, z: 0 } });
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

    if(!players.has(playerID)){
        return false;
    }
    let player = players.get(playerID);

    player.location = location;
    players.set(playerID, { gameID: gameID, location: location });


    return true;
}

function arPosCalculation(playerID) {
    const game = lookForGameWithPlayer(playerID)
    const playersArray = games.get(game).players;
    const user = players.get(playerID)
    const origin = user.location

    let locations = [];

    for (const p of playersArray) {
        const selectedPlayer = players.get(p.playerID)
        const playerARPosition = geoToLocal(selectedPlayer.location, origin)
        locations.push({
            playerID: p.playerID,
            location: playerARPosition
        })
    }
        //OPTIONAL LOGGING TO FILE------------------------------------------------------------------------------------------
    fs.appendFile(
        'log.txt',
        JSON.stringify(locations, null, 2) + '\n',
        (err) => {
            if (err) {
                console.error("Error appending to log.txt:", err);
            }
        }
    );
    let playerSocket = playerSockets.get(playerID);
    if (playerSocket && playerSocket.readyState === 1) {
        try {
            playerSocket.send(JSON.stringify({
                type: "AR_POSITIONS",
                locations: locations,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.error("Failed to send AR_POSITIONS", err);
            playerSockets.delete(playerID);
            players.delete(playerID);
            leaveGame(lookForGameWithPlayer(playerID), playerID);
        }
    } else if (!playerSocket) {
        if(playerID){
            console.error("Player socket missing:", playerID);
        } else{
            console.log("Player ID is missing");
        }
    } else {
        if(playerID){
            console.error("Player socket not open:", playerID, playerSocket.readyState);
        } else {
            console.log("Player ID is missing");
        }
    }
}

function geoToECEF(location) {
    const a = 6378137.0;
    const e2 = 6.69437999014e-3;

    const latRad = location.lat * Math.PI / 180;
    const lonRad = location.lon * Math.PI / 180;
    const alt = location.alt ?? 0;
    
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);

    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

    const x = (N + alt) * cosLat * cosLon;
    const y = (N + alt) * cosLat * sinLon;
    const z = (N * (1 - e2) + alt) * sinLat;

    return {x, y, z};
}

function ecefToENU(pointECRF, originECEF, originLat, originLon) {
    const lat0 = originLat * Math.PI / 180;
    const lon0 = originLon * Math.PI / 180;
    
    const dx = pointECRF.x - originECEF.x;
    const dy = pointECRF.y - originECEF.y;
    const dz = pointECRF.z - originECEF.z;

    const sinLat = Math.sin(lat0);
    const cosLat = Math.cos(lat0);
    const sinLon = Math.sin(lon0);
    const cosLon = Math.cos(lon0);

    const east = -sinLon * dx + cosLon * dy;
    const north = (-sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz) * -1;
    const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

    return {east, north, up};
}

function geoToLocal(playerLocation, origin) {
    const originECEF = geoToECEF(origin);

    const pointECRF = geoToECEF(playerLocation);

    const {east, north, up} = ecefToENU(pointECRF, originECEF, origin.lat, origin.lon);

    return {"x": east, "y": up, "z": north}
}

function getLocations(gameID) {
    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }
    //Could be done in one loop. Optimization for later.
    let playersArray = games.get(gameID).players;
    let locations = playersArray.filter(p => players.has(p.playerID)).map(player => ({
        playerID: player.playerID,
        location: players.get(player.playerID).location,
    }));
    for (let player of playersArray) {
        let playerSocket = playerSockets.get(player.playerID);
        if (playerSocket && playerSocket.readyState === 1) {
            try {
                playerSocket.send(JSON.stringify({
                    type: "PLAYERS_UPDATE",
                    locations,
                    timestamp: Date.now()
                }));
            } catch (err) {
                console.error("Failed to send PLAYERS_UPDATE", err);
                playerSockets.delete(player.playerID);
                players.delete(player.playerID);
                leaveGame(lookForGameWithPlayer(player.playerID), player.playerID);
            }
        } else if (!playerSocket) {
            if(player.playerID){
                console.error("Player socket missing:", player.playerID);
            } else{
                console.log("Player ID is missing");
            }
        } else {
            if(player.playerID){
                console.error("Player socket not open:", player.playerID, playerSocket.readyState);
            } else {
                console.log("Player ID is missing");
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
        //getLocations(gameID);
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
    startHidePhase(gameID);
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
            if(player.playerID){
                console.error("Player socket missing:", player.playerID);
            } else{
                console.log("Player ID is missing");
            }
        } else {
            if(player.playerID){
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
            if(player.playerID){
                console.error("Player socket missing:", player.playerID);
            } else{
                console.log("Player ID is missing");
            }
        } else {
            if(player.playerID){
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
    players.set(newplayerID, { gameID: gameID, location: { y: 0, x: 0, z: 0 } });
    playerSockets.set(newplayerID, socket);
    console.log(`Player: ${newplayerID} has joined the game`);
    return true;
}

export function gameManager(data, socket) {

    let game = null;

    switch (data.type) {
        case "CREATE_GAME":
            console.log("Origin: ", data.origin)
            game = gameCreate(data.playerID, data.circleRadius, data.circleCenter, data.origin, socket);
            if(game == false){
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
            updateLocation(lookForGameWithPlayer(data.playerID), data.playerID, data.location);
            arPosCalculation(data.playerID)
            break;
        case "LEAVE_GAME":
            leaveGame(lookForGameWithPlayer(data.playerID), data.playerID);
            break;
        case "GET_LOCATIONS":
            let locations = getLocations(lookForGameWithPlayer(data.playerID));
            if (locations == false) {
                return { error: "game does not exist" };
            }
            return { locations: locations };
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
        case "SHOW_PLAYERS":
            let gameID3 = lookForGameWithPlayer(data.playerID);
            if (gameID3) {
                return getLocations(gameID3);
            } else {
                return { error: `Invalid event type: ${data.type}` };
            }
            break;
        // case "START_AR":
        //     updateLocation(lookForGameWithPlayer(data.playerID), data.playerID, data.location)
        //     arPosCalculation(data.playerID)
        //     break;
        default:
            console.log("Invalid event type received: " + data.type);
            return { error: `Invalid event type: ${data.type}` };
    }
}






