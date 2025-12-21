import { prototype } from "ws";


// In-memory storage for games - TO BE CACHED INTO REDIS LATER
var games = new Map();

function checkGameExists(gameID) {
    return games.has(gameID);
}


function gameCreate(playerID, circleRadius, center) {
    const gameID = Math.random().toString(36).substring(2, 12);
    console.log("Game started by player: " + playerID);
    //Initialize game state

    const game = {
        gameId: gameID,
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
    return true;
}

function updateLocation(gameID, playerID, location) {
    let playersArray = games.get(gameID).players;

    playersArray.forEach(player => {
        if (player.playerID == playerID) {
            player.location = location;
            console.log(`Player: ${playerID} location updated to Lat: ${location.lat} Lng: ${location.lng} Alt: ${location.alt}`);
            return true;
        }
    });
}

function gameStart(gameID) {
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
    let playersArray = games.get(gameID).players;
    //Saftey Check, Might remove, On Possiblity of Lifetime Player ID linked to account. 
    playersArray.forEach(player => {
        if (player.playerID == newplayerID) {
            return true;
        }
    });

    if (checkGameExists(gameID) == false) {
        console.log("ERROR: GAME DOES NOT EXIST");
        return false;
    }

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
    console.log(`Player: ${newplayerID} has joined the game`);
    return true;
}

export function gameManager(data) {

    let game = null;

    switch (data.eventType) {
        case "CREATE_GAME":
            game = gameCreate(data.playerID, data.circleRadius, data.circleCenter);
            games.set(data.gameID, data);
            return { gameID: game.gameId };
        case "JOIN_GAME":
            //figure authentication
            let status = joinGame(data.gameID, data.playerID);
            if (status == false) {
                return { error: "game does not exist" };
            }
            break;
        //     return joinGame(data.gameID, data.playerID);
        case "START_GAME":
                gameStart(data.gameID);
            break;
        case "LOCATION_UPDATE":

            updateLocation(data.gameID, data.playerID, data.location);
            break;
        case "LEAVE_GAME":
            leaveGame(data.gameID, data.playerID);
            break;
        default:
            return { error: "Invalid event type" };
    }
}




