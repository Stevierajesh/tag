// const game = {
//     id: "game123",
//     players: [],
//     state: "LOBBY"
// }


export function gameManager(){

    //EDIT THIS, INHERITANCE MAKE NO SENSE, GAME MANAGER MUST BE CALLED AND GAME MANAGER MUST START GAME
    function gameStart(playerID, circleRadius, center){
        const gameID = Math.random().toString(36).substring(2, 12);
        console.log("Game started by player: " + playerID);
        //Initialize game state
        return{
            gameId: gameID,
            phase: "LOBBY",
            players: [
                {playerID: playerID, status: "infected"}
            ],
            circleCenter: center,
            circleRadius: circleRadius
        }

    }
}

