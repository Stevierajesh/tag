# Tag VPS Backend

Tag game that users can download, play tag and have locations show up every 5 minutes for 30 seconds where the players can use AR to see the locations of people. Feature where the circle shrinks at the same 5 minute mark.

## Resources

- [Lucidchart Diagram](https://lucid.app/lucidchart/af77e38f-d24e-40e7-9b81-f39b63f91eff/edit?viewport_loc=-572%2C-34%2C3326%2C1662%2C0_0&invitationId=inv_79efcca3-b16a-4b88-8097-694f88ad23bb)


UPDATE: PLAYER ID WILL BE A PERMANENT ID ASSIGNED TO PLAYER WHEN ACCOUNT IS CREATED

## Websocket Event Types

### CREATE_GAME
```json
{
    "type": "CREATE_GAME",
    "playerID": "p42"
}
```

### JOIN_GAME
```json
{
    "playerID": "p43",
    "type": "JOIN_GAME",
    "gameId": "abc123"
}
```

### START_GAME
```json
{
    "playerID": "p43",
    "type": "START_GAME"
}
```

### LOCATION_UPDATE
```json
{
    "playerID": "p43",
    "type": "LOCATION_UPDATE",
    "location": {
        "lat": 40.21049935750206,
        "lng": -83.02927517362363,
        "alt": 276.4463550494984
    },
    "timestamp": 1739999999
}
```

### GAME_STATE
```json
{
    "type": "GAME_STATE",
    "gameId": "abc123",
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

### REVEAL_START
```json
{
    "type": "REVEAL_START",
    "revealEndsAt": 1740000330,
    "circleRadius": 320
}
```

### REVEAL_END
```json
{
    "type": "REVEAL_END",
    "nextRevealAt": 1740000630,
    "circleRadius": 272
}
```

### TAG_RESULT
```json
{
    "type": "TAG_RESULT",
    "infectedPlayerId": "p17"
}
```

### ERROR
```json
{
    "type": "ERROR",
    "message": "Only admin can start the game"
}
```
