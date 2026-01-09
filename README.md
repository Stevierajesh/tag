# Tag Backend (HTTP + WebSocket)

Backend server for Tag, a real-time multiplayer infected-tag game using WebSockets and an Express HTTP server.

Players join a game, move in the real world, and periodically reveal locations for short intervals to enable AR-based tagging.

The server is authoritative: it manages game state, timing, player roles, and phase transitions entirely in memory.

## Core Game Concept

Players play infected tag:

- One or more players start as **infected**
- All other players are **runners**

Player locations are:

- **Hidden** for a configurable duration (currently 0 seconds)
- **Revealed** for a configurable duration (currently 10 seconds)

This cycle repeats until:

- All runners are infected, or
- The game is ended by the admin

During reveal windows:

- Players can use AR to visualize nearby opponents
- Tags can be attempted

The playable area is constrained by a circle that can shrink over time.

## Architecture Overview

- **Node.js + WebSocket**
- Single server process (Express + ws)
- One WebSocket connection per player
- Event-driven game logic
- Timers are owned by individual game sessions
- All game state stored in memory

### High-Level Data Flow

```
Client
    ↓ WebSocket Event
Server (gameManager)
    ↓
Game state updated
    ↓
Timers trigger phase changes
    ↓
Server notifies clients
```

## In-Memory State

### Games

```
games: Map<gameID, Game>
```

Each game tracks:

- Current phase (LOBBY, HIDE, SEEK)
- Players
- Circle data
- Active timer

### Players

```
players: Map<playerID, { gameID, location }>
```

Used for:

- O(1) lookup of which game a player belongs to
- Fast access to most recent player location

## Game Phases

### LOBBY

- Players can join
- Game has not started
- Admin can start the game

### HIDE (configurable, currently 0s)

- Player locations are hidden
- Players move freely
- Circle is enforced on the client side

### SEEK / REVEAL (configurable, currently 10s)

- Player locations are revealed
- AR visualization enabled
- Tags can be attempted

The game cycles between HIDE and SEEK using server-side timers. After `START_GAME`, the server waits 5 seconds, then begins the HIDE/SEEK loop.

## Timers & Phase Control

Phase transitions are controlled using chained `setTimeout` calls:

- Each game owns one active timer
- When a phase begins, it schedules the next phase
- When a game ends, timers stop automatically when the game is removed
 - During SEEK, the server broadcasts `PLAYERS_UPDATE` every ~200ms

This ensures:

- No blocking loops
- Multiple games can run simultaneously
- Server remains responsive

## WebSocket Event Types

### CREATE_GAME

Creates a new game and assigns the creator as admin and infected.

**Request:**

```json
{
    "type": "CREATE_GAME",
    "playerID": "p42",
    "circleRadius": 320,
    "circleCenter": { "x": 0, "y": 0, "z": 0 },
    "origin": { "lat": 40.0, "lon": -83.0, "alt": 0 }
}
```

**Response:**

```json
{
    "type": "GAMEID",
    "gameID": "abc123"
}
```

### JOIN_GAME

Adds a player to an existing game.

```json
{
    "type": "JOIN_GAME",
    "playerID": "p43",
    "gameID": "abc123"
}
```

### START_GAME

Starts the game (admin only).

```json
{
    "type": "START_GAME",
    "playerID": "p42"
}
```

Transitions the game from LOBBY → HIDE.

### LOCATION_UPDATE

Sent frequently by clients to update their current position.

```json
{
    "type": "LOCATION_UPDATE",
    "playerID": "p43",
    "location": {
        "lat": 40.21049935750206,
        "lon": -83.02927517362363,
        "alt": 276.4463550494984,
        "heading": 182.5
    },
    "timestamp": 1739999999
}
```

### PLAYERS_UPDATE

Broadcast to clients with current player locations during reveal phases.

```json
{
  "type": "PLAYERS_UPDATE",
  "locations": {
    "player1": {
      "playerID": "player1",
      "location": { "lat": 40.0, "lon": -83.0, "alt": 0 },
      "origin": { "lat": 40.0, "lon": -83.0, "alt": 0 }
    },
    "player2": {
      "playerID": "player2",
      "location": { "lat": 40.0, "lon": -83.0, "alt": 0 },
      "origin": { "lat": 40.0, "lon": -83.0, "alt": 0 }
    }
  },
  "timestamp": 1704537600000
}

```

### LEAVE_GAME

Removes a player from their current game.

```json
{
    "type": "LEAVE_GAME",
    "playerID": "p43"
}
```

If all players leave, the game is deleted.

### TAG_ATTEMPT

Sent when a player attempts to tag another player (server currently only logs the attempt).

```json
{
    "type": "TAG_ATTEMPT",
    "infectedPlayerID": "p17",
    "targetPlayerID": "p42"
}
```

### END_GAME

Ends a game and removes it from memory.

```json
{
    "type": "END_GAME",
    "playerID": "p42"
}
```

### START_AR

Stores the first heading reading for AR alignment.

```json
{
    "type": "START_AR",
    "playerID": "p42",
    "location": {
        "lat": 40.0,
        "lon": -83.0,
        "alt": 0,
        "heading": 182.5
    }
}
```

### LOCAL_POSITIONS

Stores client-side local AR coordinates for a player.

```json
{
    "type": "LOCAL_POSITIONS",
    "playerID": "p42",
    "location": { "x": 1.2, "y": 0.0, "z": -3.4 }
}
```

### ERROR

Sent when an invalid action occurs.

```json
{
    "type": "ERROR",
    "message": "Only admin can start the game"
}
```

## HTTP Endpoints

- `GET /__debug/state`: return in-memory games/players/socket state
- `POST /deleteGame`: delete a game by `gameID`
- `POST /logLocations`: append a list of locations to `locations_log.txt`
- `POST /toggleLogBlock`: allow the next location update to be logged (debug)

## Running Locally

```bash
npm install
node server.js
```

Server listens on `http://localhost:8080` and serves the `dashboard/` static UI at `/`.

## Player Identity

- `playerID` is a permanent identifier
- Assigned at account creation
- Used across all games
- Allows reconnects and long-lived profiles

## Current Limitations

- All state is in memory
- Server restart clears all games
- Redis integration planned for persistence and scaling

## Related Resources

<!-- Add links to related documentation, repositories, or resources here -->
