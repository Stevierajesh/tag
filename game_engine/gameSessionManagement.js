


// In-memory storage for games - TO BE CACHED INTO REDIS LATER
var games = new Map();
var players = new Map();

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
        circleRadius: circleRadius
    }

    players.set(playerID, {gameID: game.gameID, location: { lat: null, lng: null, alt: null }});
    games.set(game.gameID, game);
    return game;
}

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
    return true;

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

    player = {
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
            games.set(data.gameID, data);
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
            console.log("all players: " + JSON.stringify(Array.from(players)));
            gameStart(gameID);
            break;
        case "LOCATION_UPDATE":
            updateLocation(lookForGameWithPlayer(data.playerID), data.playerID, data.location);
            break;
        case "LEAVE_GAME":
            leaveGame(lookForGameWithPlayer(data.playerID), data.playerID);
            break;
        default:
            console.log("Invalid event type received: " + data.type);  
            return { error: `Invalid event type: ${data.type}` };
    }
}




