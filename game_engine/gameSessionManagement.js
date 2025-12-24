


// In-memory storage for games - TO BE CACHED INTO REDIS LATER
var games = new Map();

var hideTime = 300000; //5 Minutes
var seekTime = 30000 //30 seconds

//MUST OPTIMIZE LATER - FOR UPDATING LOCATIONS IN O(1) TIME.
var players = new Map();
var playerSockets = new Map();

function checkGameExists(gameID) {
    return games.has(gameID);
}

function lookForGameWithPlayer(identification) {

    if (players.has(identification)) {
        //console.log("Found game for player: " + identification);
        let playerInfo = players.get(identification);
        return playerInfo.gameID;
    }

    return null;
}
//FIX WITH THE OPTIMIZATION LATER---------------------------------------------------------------------------------------
function gameCreate(playerID, circleRadius, center) {
    const gameID = Math.random().toString(36).substring(2, 12);
    console.log("Game started by player: " + playerID);
    //Initialize game state
    

    

    const game = {
        gameID: gameID,
        phase: "LOBBY",
        players: [
            {
                playerID: playerID, status: "infected", isAdmin: true, location: {
                    lat: null,
                    lng: null,
                    alt: null
                }
            }
        ],
        circleCenter: center,
        circleRadius: circleRadius,
        timer: null,
        sendTimer: null
    }

    players.set(playerID, {gameID: game.gameID, location: { lat: null, lng: null, alt: null }});
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
    games.delete(gameID);
    console.log(`Game: ${gameID} has been deleted`);
    return true;
}

function leaveGame(gameID, playerID) {
    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

    let playersArray = games.get(gameID).players;
    playersArray = playersArray.filter(player => player.playerID != playerID);

    games.set(gameID, { ...games.get(gameID), players: playersArray });
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

    let playersArray = games.get(gameID).players;

    //This is very inefficient, will fix later
    playersArray.forEach(player => {
        if (player.playerID == playerID) {
            player.location = location;
        }
    });

    //Suggested Fix, make location based off of players map instead of in game object
    players.set(playerID, {gameID: gameID, location: location});
    //Suggested Fix End


    games.set(gameID, { ...games.get(gameID), players: playersArray });
    console.log(`Player: ${playerID} location updated to ${JSON.stringify(location)}`);
    return true;
}
//-----------------------------------------------------------------------------------------------------------------------

//FIX WITH THE OPTIMIZATION LATER---------------------------------------------------------------------------------------
function getLocations(gameID) {
    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }




    let playersArray = games.get(gameID).players;
    let locations = playersArray.map(player => ({
        playerID: player.playerID,
        location: player.location
    }));

    socket.send(JSON.stringify({ type: "LOCATIONS_UPDATE", locations: locations, timestamp: Date.now()}));

    return locations;
}
//-----------------------------------------------------------------------------------------------------------------------

function startSeekPhase(gameID) {
    if (!checkGameExists(gameID)) return false;

    const game = games.get(gameID);
    if (game.timer) {
        clearTimeout(game.timer);
    }

    game.phase = "SEEK";
    console.log(`Game ${gameID} entering SEEK phase`);

    game.timer = setTimeout(() => {

        game.seekTime = setInterval(() => {
            getLocations(gameID);
        }, 2000); //Every 10 seconds during seek phase     

        if (checkGameExists(gameID)) {
            startHidePhase(gameID);
        }
    }, seekTime);

    games.set(gameID, game);
    return true;
}


function startHidePhase(gameID) {
    if (!checkGameExists(gameID)) return false;

    const game = games.get(gameID);

    if (game.timer) {
        clearTimeout(game.timer);
    }

    game.phase = "HIDE";
    console.log(`Game ${gameID} entering HIDE phase`);

    game.timer = setTimeout(() => {
        if (checkGameExists(gameID)) {
            startSeekPhase(gameID);
        }
    }, hideTime);

    games.set(gameID, game);
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

function joinGame(gameID, newplayerID) {
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

    let player = {
        playerID: newplayerID,
        status: "running",
        isAdmin: false,
        location: {
            lat: null,
            lng: null,
            alt: null
        }
    }

    playersArray.push(player);

    games.set(gameID, { ...games.get(gameID), players: playersArray });
    players.set(newplayerID, {gameID: gameID, location: { lat: null, lng: null, alt: null }});
    console.log(`Player: ${newplayerID} has joined the game`);
    return true;
}

export function gameManager(data) {

    let game = null;

    switch (data.type) {
        case "CREATE_GAME":
            game = gameCreate(data.playerID, data.circleRadius, data.circleCenter);
            games.set(game.gameID, game);
            console.log(`Game created with ID: ${game.gameID}`);
            return { gameID: game.gameID };
        case "JOIN_GAME":
            //figure authentication
            let status = joinGame(data.gameID, data.playerID);
            if (status == false) {
                return { error: "game does not exist" };
            }
            break;
        //     return joinGame(data.gameID, data.playerID);
        case "START_GAME":
            let gameID = lookForGameWithPlayer(data.playerID);
            console.log("starting game");
            
            gameStart(gameID);
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
            console.log(`Game: ${data.gameID} has ended`);
            signalPlayersGameEnd(data.gameID);
            deleteGame(data.gameID);
            break;
        default:
            console.log("Invalid event type received: " + data.type);  
            return { error: `Invalid event type: ${data.type}` };
    }
}




