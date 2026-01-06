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

    return {x, y, z};
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
    const north = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
    const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

    return {east, north, up};
}

function geoToLocal(playerLocation, origin) {
    const originECEF = geoToECEF(origin);

    const pointECRF = geoToECEF(playerLocation);

    const {east, north, up} = ecefToENU(pointECRF, originECEF, origin.lat, origin.lon);

    return {"x": east, "y": up, "z": north}
}

function rotateCoordinates(coordinate, headingDeg) {
    const psi = headingDeg * Math.PI / 180; 
    const theta = -psi;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const x2 = coordinate.x * cosT + coordinate.z * sinT;
    const y2 = coordinate.y;
    const z2 = -coordinate.x * sinT + coordinate.z * cosT;

    return { x: x2, y: y2, z: z2 };
}

const origin = {
    lat: 40.213159362837395,
    lon: -83.03193827947317,
    alt: 282.2326139640063
};

const p2 = {
    lat: 40.21311325757867,
    lon: -83.03190340966114,
    alt: 281.5915466565639
}

const p1 = {
    lat: 40.21313490582065,
    lon: -83.03186750769558,
    alt: 281.7544538639486
}

const headingDeg = 90

const p1Vector = geoToLocal(p1, origin);
const p2Vector = geoToLocal(p2, origin);

const p1p2Vector = {
    x: p2Vector.x - p1Vector.x,
    y: p2Vector.y - p1Vector.y,
    z: p2Vector.z - p1Vector.z
}

const alignedP1P2Vector = rotateCoordinates(p1p2Vector, headingDeg)

console.log("P1 Vector: ", p1Vector);
console.log("P2 Vector: ", p2Vector);
console.log("P1P2 Vector: ", p1p2Vector);
console.log("Aligned P1P2 Vector: ", alignedP1P2Vector);

