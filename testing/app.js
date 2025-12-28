///TEST CONNECTION TO WEBSOCKET SERVER FROM BROWSER



const socket = new WebSocket('ws://localhost:8080');


socket.onmessage = ({ data }) => {
    console.log('message from server ', data);
};

const testMessages = {
  CREATE_GAME: {
    type: "CREATE_GAME",
    playerId: "p42"
  },

  JOIN_GAME: {
    type: "JOIN_GAME",
    gameId: "abc123"
  },

  START_GAME: {
    type: "START_GAME"
  },

  LOCATION_UPDATE: {
    type: "LOCATION_UPDATE",
    location: {
      lat: 40.21049935750206,
      lng: -83.02927517362363,
      alt: 276.4463550494984
    },
    timestamp: 1739999999
  },

  GAME_STATE: {
    type: "GAME_STATE",
    gameId: "abc123",
    phase: "HIDE",
    circleRadius: 320,
    you: {
      playerId: "p42",
      role: "RUNNER",
      isAdmin: false
    },
    players: [
      { playerId: "p17", status: "INFECTED" },
      { playerId: "p42", status: "RUNNER" }
    ],
    nextRevealAt: 1740000300
  },

  REVEAL_START: {
    type: "REVEAL_START",
    revealEndsAt: 1740000330,
    circleRadius: 320
  },

  REVEAL_END: {
    type: "REVEAL_END",
    nextRevealAt: 1740000630,
    circleRadius: 272
  },

  TAG_RESULT: {
    type: "TAG_RESULT",
    infectedPlayerId: "p17"
  },

  ERROR: {
    type: "ERROR",
    message: "Only admin can start the game"
  }
};

document.querySelector('button').onclick = () => {
    Object.values(testMessages).forEach(element => {
       socket.send(JSON.stringify(element)); 
    });
}


//BASIC UNLOAD ONLY, WHEN USER CLOSES BROWSER OR RELOADS PAGE.
window.addEventListener("beforeunload", () => {
  socket.send(JSON.stringify({ type: "LEAVE_GAME" }));
  socket.close();
});


