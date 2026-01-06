# Tag VPS Backend

Backend server for Tag, a real-time multiplayer infected-tag game using WebSockets.

Players join a game, move in the real world, and periodically reveal locations for short intervals to enable AR-based tagging.

The server is authoritative: it manages game state, timing, player roles, and phase transitions.

## Core Game Concept

Players play infected tag:

- One or more players start as **infected**
- All other players are **runners**

Player locations are:

- **Hidden** for 5 minutes
- **Revealed** for 30 seconds

This cycle repeats until:

- All runners are infected, or
- The game is ended by the admin

During reveal windows:

- Players can use AR to visualize nearby opponents
- Tags can be attempted

The playable area is constrained by a circle that can shrink over time.

## Architecture Overview

- **Node.js + WebSocket**
- Single server process
- One WebSocket connection per player
- Event-driven game logic
- Timers are owned by individual game sessions
- All game state stored in memory (planned Redis migration)

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

### HIDE (5 minutes)

- Player locations are hidden
- Players move freely
- Circle is enforced

### SEEK / REVEAL (30 seconds)

- Player locations are revealed
- AR visualization enabled
- Tags can be attempted

The game cycles between HIDE and SEEK using server-side timers.

## Timers & Phase Control

Phase transitions are controlled using chained `setTimeout` calls:

- Each game owns one active timer
- When a phase begins, it schedules the next phase
- When a game ends, timers stop automatically when the game is removed

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
    "playerID": "p42"
}
```

**Response:**

```json
{
    "gameID": "abc123"
}
```

### JOIN_GAME

Adds a player to an existing game.

```json
{
    "type": "JOIN_GAME",
    "playerID": "p43",
    "gameId": "abc123"
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
        "y": 40.21049935750206,
        "x": -83.02927517362363,
        "z": 276.4463550494984
    },
    "timestamp": 1739999999
}
```

### GAME_STATE [PLANNED]

Sent to clients to synchronize full game state.

```json
{
    "type": "GAME_STATE",
    "gameID": "abc123",
    "phase": "HIDE",
    "circleRadius": 320,
    "you": {
        "playerID": "p42",
        "role": "RUNNER",
        "isAdmin": false
    },
    "players": [
        { "playerID": "p17", "status": "INFECTED" },
        { "playerID": "p42", "status": "RUNNER" }
    ],
    "nextRevealAt": 1740000300
}
```

### REVEAL_START [[PLANNED]]

Broadcast when a SEEK phase begins.

```json
{
    "type": "REVEAL_START",
    "revealEndsAt": 1740000330,
    "circleRadius": 320
}
```

### REVEAL_END [[PLANNED]]

Broadcast when the reveal window ends.

```json
{
    "type": "REVEAL_END",
    "nextRevealAt": 1740000630,
    "circleRadius": 272
}
```

### TAG_RESULT [[PLANNED]]

Sent when a tag is successfully registered.

```json
{
    "type": "TAG_RESULT",
    "infectedPlayerId": "p17"
}
```

### PLAYERS_UPDATE

Broadcast to clients with current player locations during reveal phases.

```json
{
  "type": "PLAYERS_UPDATE",
  "locations": [
    {
      "playerID": "player1",
      "location": {
        "x": 12.34,
        "y": 56.78,
        "z": 90.12
      }
    },
    {
      "playerID": "player2",
      "location": {
        "x": -45.67,
        "y": 89.01,
        "z": -23.45
      }
    }
  ],
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

### END_GAME

Ends a game and removes it from memory.

```json
{
    "type": "END_GAME",
    "gameID": "abc123"
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