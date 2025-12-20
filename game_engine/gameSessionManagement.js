

// In-memory storage for games - TO BE CACHED INTO REDIS LATER
var games = new Map();

function gameStart(playerID, circleRadius, center) {
    const gameID = Math.random().toString(36).substring(2, 12);
    console.log("Game started by player: " + playerID);
    //Initialize game state
    return {
        gameId: gameID,
        phase: "LOBBY",
        players: [
            { playerID: playerID, status: "infected" }
        ],
        circleCenter: center,
        circleRadius: circleRadius
    }

}

function joinGame(gameID, playerID) {

    if (!games.has(gameID)){
        console.log("ERROR: GAME DOES NOT EXIST");
    } else {
        games.set(gameID, game.players.push(playerID));
        console.log(`Player: ${playerID} has joined the game`);
        return true;
    }

}

export function gameManager(data) {

    let game = null;

    switch (data.eventType) {
        case "CREATE_GAME":
            game = gameStart(data.playerID, data.circleRadius, data.circleCenter);
            games.set(data.gameID, data);
        case "JOIN_GAME":
            //figure authentication
            let playerID = null;
            joinGame(data.gameID);
        //     return joinGame(data.gameID, data.playerID);
        case "LOCATION_UPDATE":
        //     return updateLocation(data.gameID, data.playerID, data.location);
        case "LEAVE_GAME":
        //     return leaveGame(data.gameID, data.playerID);
        case "TAG_ATTEMPT":
        //     return tagAttempt(data.gameID, data.taggerID, data.targetID);
        case "REVEAL_START":
        //     return revealStart(data.gameID);
        case "REVEAL_END":
        //     return revealEnd(data.gameID);
        default:
            return { error: "Invalid event type" };
    }

}




