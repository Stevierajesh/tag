


// In-memory storage for games - TO BE CACHED INTO REDIS LATER
export var games = new Map();

var gameTimers = new Map();

var hideTime = 0; //10 seconds
var seekTime = 10000 //10 seconds
var sendTime = 200; //0.5 seconds

//MUST OPTIMIZE LATER - FOR UPDATING LOCATIONS IN O(1) TIME.
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
//FIX WITH THE OPTIMIZATION LATER---------------------------------------------------------------------------------------
function gameCreate(playerID, circleRadius, center, socket) {
    const gameID = Math.random().toString(36).substring(2, 6);
    console.log("Game started by player: " + playerID);
    //Initialize game state




    const game = {
        gameID: gameID,
        phase: "LOBBY",
        players: [
            {
                playerID: playerID, status: "infected", isAdmin: true
            }
        ],
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

    players.set(playerID, { gameID: game.gameID, location: { lat: 0, lon: 0, alt: 0 } });
    console.log("Adding Socket: " + socket);
    playerSockets.set(playerID, socket);
    games.set(game.gameID, game);
    return game;
}
//FIX WITH THE OPTIMIZATION LATER---------------------------------------------------------------------------------------

function deleteGame(gameID) {
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
        clearTimeout(gameTimers.get(gameID));
        gameTimers.delete(gameID);
    }

    games.delete(gameID);
    gameTimers.delete(gameID);

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


//FIX WITH THE OPTIMIZATION LATER---------------------------------------------------------------------------------------

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

    //Suggested Fix
    let player = players.get(playerID);
    player.location = location;
    //Suggested Fix End
    

    //Suggested Fix, make location based off of players map instead of in game object
    players.set(playerID, { gameID: gameID, location: location });
    //Suggested Fix End


    //games.set(gameID, { ...games.get(gameID), players: playersArray });
    //console.log(`Player: ${playerID} location updated to ${JSON.stringify(location)}`);
    return true;
}
//-----------------------------------------------------------------------------------------------------------------------

//FIX WITH THE OPTIMIZATION LATER---------------------------------------------------------------------------------------
function getLocations(gameID) {
    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }


    //Suggested Fix
    let playersArray = games.get(gameID).players;
    let locations = playersArray.map(player => ({
        playerID: player.playerID,
        location: players.get(player.playerID).location
    }));
    //Suggested Fix END

    for(let player of playersArray){
        let playerSocket = playerSockets.get(player.playerID);
        if(playerSocket){
            playerSocket.send(JSON.stringify({ type: "PLAYERS_UPDATE", locations: locations, timestamp: Date.now() }));
            //console.log("Location Payload" + JSON.stringify({ type: "PLAYERS_UPDATE", locations: locations, timestamp: Date.now() }));
        } else {
            console.log("ERROR: Player socket not found for playerID " + player.playerID);
        }
    }

    //socket.send(JSON.stringify({ type: "LOCATIONS_UPDATE", locations: locations, timestamp: Date.now() }));

    return locations;
}
//-----------------------------------------------------------------------------------------------------------------------

function startSeekPhase(gameID) {
    if (!checkGameExists(gameID)) return false;

    const game = games.get(gameID);
    const gameTimer = gameTimers.get(gameID) ?? {};

    if (gameTimer.seekTimer) {
        clearTimeout(gameTimer.seekTimer);
    }

    if(gameTimer.intervalTime) {
        clearInterval(gameTimer.intervalTime);
    }



    game.phase = "SEEK";
    console.log(`Game ${gameID} entering SEEK phase`);

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
    console.log(`Game ${gameID} entering HIDE phase`);

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
    //Not Implemented Yet
    let game = games.get(gameID);
    game.players.forEach(player => {
        let playerSocket = playerSockets.get(player.playerID);
        playerSocket.send(JSON.stringify({ type: "GAME_STARTED", gameID: gameID }));
    });
    //
    // socket.send(JSON.stringify({ type: "GAME_STARTED", gameID: gameID }));
}

function signalPlayersGameEnd(gameID) {
    //Not Implemented Yet
    let game = games.get(gameID);
    game.players.forEach(player => {
        let playerSocket = playerSockets.get(player.playerID);
        playerSocket.send(JSON.stringify({ type: "GAME_ENDED", gameID: gameID }));
    });
    //
    // socket.send(JSON.stringify({ type: "GAME_STARTED", gameID: gameID }));
}

function joinGame(gameID, newplayerID, socket) {
    //ERROR HERE

    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

    let playersArray = games.get(gameID).players;
    //Saftey Check, Might remove, On Possiblity of Lifetime Player ID linked to account. 
    playersArray.forEach(player => {
        if (player.playerID == newplayerID) {
            return true;
        }
    });

    //Suggested Fix
    let player = {
        playerID: newplayerID,
        status: "running",
        isAdmin: false,
    }
    //Suggested Fix END

    playersArray.push(player);


    games.set(gameID, { ...games.get(gameID), players: playersArray });
    players.set(newplayerID, { gameID: gameID, location: { lat: 0, lon: 0, alt: 0 } });
    playerSockets.set(newplayerID, socket);
    console.log(`Player: ${newplayerID} has joined the game`);
    return true;
}

export function gameManager(data, socket) {

    let game = null;

    switch (data.type) {
        case "CREATE_GAME":
            game = gameCreate(data.playerID, data.circleRadius, data.circleCenter, socket);
            games.set(game.gameID, game);
            console.log(`Game created with ID: ${game.gameID}`);
            return { gameID: game.gameID };
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
            updateLocation(lookForGameWithPlayer(data.playerID), data.playerID, data.location);
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
            if(gameID2){
                signalPlayersGameEnd(gameID2);
                deleteGame(gameID2);
            } else {
                return { error: `Invalid event type: ${data.type}` };
            }
            break;
        default:
            console.log("Invalid event type received: " + data.type);
            return { error: `Invalid event type: ${data.type}` };
    }
}






