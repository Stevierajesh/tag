function arPosCalculation(playerID) {
    const game = lookForGameWithPlayer(playerID)
    const playersArray = games.get(game).players;
    const user = players.get(playerID)
    const origin = user.origin
    const headingDeg = user.prevHeading
    let locations = [];



    //CALCULATIONS SRI MENTIONED HERE.

    for (const p of playersArray) {
        //YOU'RE NOT SUBTRACTING THE ORIGIN FROM EACH PLAYER'S COORDINATES BEFORE ROTATING.
        const selectedPlayer = players.get(p.playerID)
        const playerARPosition = geoToLocal(selectedPlayer.location, origin)
        const alignedPosition = rotateCoordinates(playerARPosition, headingDeg)
        locations.push({
            playerID: p.playerID,
            location: alignedPosition
        })
    }
    //OPTIONAL LOGGING TO FILE------------------------------------------------------------------------------------------
    if (LOGBLOCKED == false) {
        fs.appendFile(
            'log.txt',
            JSON.stringify(locations, null, 2) + '\n',
            (err) => {
                if (err) {
                    console.error("Error appending to log.txt:", err);
                }
            }
        );
        LOGBLOCKED = true; //Reset the block
    }
    let playerSocket = playerSockets.get(playerID);
    if (playerSocket && playerSocket.readyState === 1) {
        try {
            playerSocket.send(JSON.stringify({
                type: "AR_POSITIONS",
                locations: locations,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.error("Failed to send AR_POSITIONS", err);
            playerSockets.delete(playerID);
            players.delete(playerID);
            leaveGame(lookForGameWithPlayer(playerID), playerID);
        }
    } else if (!playerSocket) {
        if (playerID) {
            console.error("Player socket missing:", playerID);
        } else {
            console.log("Player ID is missing");
        }
    } else {
        if (playerID) {
            console.error("Player socket not open:", playerID, playerSocket.readyState);
        } else {
            console.log("Player ID is missing");
        }
    }
}

function geoToECEF(location) {
    const a = 6378137.0;
    const e2 = 6.69437999014e-3;

    const latRad = location.lat * Math.PI / 180;
    const lonRad = location.lon * Math.PI / 180;
    const alt = location.alt ?? 0;

    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);

    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

    const x = (N + alt) * cosLat * cosLon;
    const y = (N + alt) * cosLat * sinLon;
    const z = (N * (1 - e2) + alt) * sinLat;

    return { x, y, z };
}

function ecefToENU(pointECRF, originECEF, originLat, originLon) {
    const lat0 = originLat * Math.PI / 180;
    const lon0 = originLon * Math.PI / 180;

    const dx = pointECRF.x - originECEF.x;
    const dy = pointECRF.y - originECEF.y;
    const dz = pointECRF.z - originECEF.z;

    const sinLat = Math.sin(lat0);
    const cosLat = Math.cos(lat0);
    const sinLon = Math.sin(lon0);
    const cosLon = Math.cos(lon0);

    const east = -sinLon * dx + cosLon * dy;
    const north = (-sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz) * -1;
    const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

    return { east, north, up };
}

function geoToLocal(playerLocation, origin) {
    const originECEF = geoToECEF(origin);

    const pointECRF = geoToECEF(playerLocation);

    const { east, north, up } = ecefToENU(pointECRF, originECEF, origin.lat, origin.lon);

    return { "x": east, "y": up, "z": north }
}

function rotateCoordinates(coordinate, headingDeg) {

    //console.log("Heading Deg: " + headingDeg + " Coordinate: ", coordinate);
    const psi = headingDeg * Math.PI / 180;
    const theta = -psi;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const x2 = coordinate.x * cosT + coordinate.z * sinT;
    const y2 = coordinate.y;
    const z2 = -coordinate.x * sinT + coordinate.z * cosT;

    return { x: x2, y: y2, z: z2 };
}