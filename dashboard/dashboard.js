import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';


const REFRESH_INTERVAL = 1000;

let state = null;
let selectedGameID = null;
let threeDViewActive = false;
let threeDViewPlayerID = null;

setInterval(() => {
  if (!threeDViewActive || !threeDViewPlayerID) return;
  updatePlayerMeshes();
}, 200);



/* ----------------------------- FETCH STATE ----------------------------- */

const API_BASE = window.location.origin;

async function fetchState() {
  try {
    const res = await fetch(`${API_BASE}/__debug/state`);
    if (!res.ok) throw new Error('Bad response');

    state = await res.json();

    // FIX 1: auto-select a game
    if (!selectedGameID) {
      const firstGame = Object.keys(state.games || {})[0];
      selectedGameID = firstGame ?? null;
    }

    // FIX 2: ensure maps always exist
    state.players = state.players || {};
    state.playerSockets = state.playerSockets || {};

    setServerOnline();
    render();
  } catch (err) {
    setServerOffline();
    console.error('Dashboard fetch failed', err);
  }
}

/* --------------------------- DELETE GAME ------------------------------- */
const deleteGameBtn = document.querySelector('.delete-game-btn');

deleteGameBtn.addEventListener('click', async () => {
  if (!selectedGameID) return;
  await deleteGame(selectedGameID);
});


async function deleteGame(gameID) {
  try {
    const res = await fetch(`${API_BASE}/deleteGame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameID })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to delete game');
    }

    // Refresh state after deletion
    await fetchState();
  } catch (err) {
    console.error('Delete game failed', err);
  }
}

/* -------------------------- SERVER STATUS ------------------------------ */



function setServerOnline() {
  const dot = document.getElementById('server-dot');
  const text = document.getElementById('server-text');

  dot.style.background = '#2ea043';
  text.textContent = 'Server Online';
}

function setServerOffline() {
  const dot = document.getElementById('server-dot');
  const text = document.getElementById('server-text');

  dot.style.background = '#f85149';
  text.textContent = 'Server Offline';
}


/* -------------------------- LOG LOCATIONS ------------------------------ */
const logLocationsBtn = document.querySelector('.log-locations-btn');

logLocationsBtn.addEventListener('click', () => {
  const game = state?.games?.[selectedGameID];
  const firstPlayerID = game?.players?.[0]?.playerID;
  if (!firstPlayerID) return;

  const livePlayer = state.players?.[firstPlayerID];

  const sampleLocations = {
    playerID: firstPlayerID,
    location: {
      lon: livePlayer?.location?.lon ?? null,
      lat: livePlayer?.location?.lat ?? null,
      alt: livePlayer?.location?.alt ?? null
    }
  };

  logLocations(sampleLocations);
});


function logLocations(locations) {
  fetch(`${API_BASE}/logLocations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations })
  }).catch(err => {
    console.error('Log locations failed', err);
  });
}

/* -------------------------- TOGGLE LOG BLOCK ------------------------------ */
const toggleLogBlockBtn = document.querySelector('.toggle-log-block-btn');

toggleLogBlockBtn.addEventListener('click', () => {
  logBlockToggle();
});

function logBlockToggle() {
  fetch(`${API_BASE}/toggleLogBlock`, {
    method: 'POST'
  }).catch(err => {
    console.error('Toggle log block failed', err);
  });
}






//-------------------------- MAP MODAL ------------------------------ */
let leafletMap;
let playerMarkers = {};

function initMap() {
  leafletMap = L.map('map').setView([0, 0], 18);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap'
  }).addTo(leafletMap);
}

function renderMapPlayers(game) {
  if (!game || !leafletMap) return;

  // Track players that should exist for this game
  const activePlayerIDs = new Set(
    game.players.map(p => p.playerID)
  );

  // Remove markers from other games
  Object.keys(playerMarkers).forEach(playerID => {
    if (!activePlayerIDs.has(playerID)) {
      leafletMap.removeLayer(playerMarkers[playerID]);
      delete playerMarkers[playerID];
    }
  });

  // Add / update markers for active game
  game.players.forEach(p => {
    const live = state.players?.[p.playerID];
    if (!live?.location?.lat || !live?.location?.lon) return;

    const { lat, lon } = live.location;

    if (!playerMarkers[p.playerID]) {
      playerMarkers[p.playerID] = L.marker([lat, lon])
        .addTo(leafletMap)
        .bindPopup(`
          <b>${p.playerID}</b><br/>
          Status: ${p.status}
        `);
    } else {
      playerMarkers[p.playerID].setLatLng([lat, lon]);
    }
  });
}


const mapToggleBtn = document.getElementById('map-toggle-btn');
const mapModal = document.getElementById('map-modal');
const mapCloseBtn = document.getElementById('map-close-btn');
const mapCard = document.querySelector('.map-card');
const mapHeader = mapCard?.querySelector('.map-header');
const mapResizeHandles = mapCard?.querySelectorAll('.resize-handle');

let mapDragState = null;
let mapResizeState = null;
let mapResizeTimer = null;
let mapObserver = null;
const MAP_MIN_WIDTH = 320;
const MAP_MIN_HEIGHT = 240;
const MAP_MARGIN = 8;

mapToggleBtn.addEventListener('click', openMapModal);

mapCloseBtn.addEventListener('click', closeMapModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !mapModal.classList.contains('hidden')) {
    closeMapModal();
  }
});

mapModal.addEventListener('click', (e) => {
  if (e.target === mapModal) {
    closeMapModal();
  }
});

function openMapModal() {
  mapModal.classList.remove('hidden');
  mapModal.classList.add('tinted');
  mapToggleBtn.classList.add('active');

  if (!leafletMap) initMap();

  if (mapCard && !mapCard.dataset.positioned) {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const width = Math.min(1100, Math.max(320, Math.floor(viewportW * 0.9)));
    const height = Math.max(240, Math.floor(viewportH * 0.8));
    const left = Math.max(12, Math.floor((viewportW - width) / 2));
    const top = Math.max(12, Math.floor((viewportH - height) / 2));

    mapCard.style.width = `${width}px`;
    mapCard.style.height = `${height}px`;
    mapCard.style.left = `${left}px`;
    mapCard.style.top = `${top}px`;
    mapCard.dataset.positioned = 'true';
  }

  setTimeout(() => {
    leafletMap.invalidateSize();
    const game = state?.games?.[selectedGameID];
    centerMapOnPlayers(game);
    renderMapPlayers(game);
  }, 50);
}


function closeMapModal() {
  mapModal.classList.add('hidden');
  mapToggleBtn.classList.remove('active');
  mapModal.classList.remove('tinted');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setMapCardPosition(left, top) {
  if (!mapCard) return;
  const maxLeft = window.innerWidth - mapCard.offsetWidth - MAP_MARGIN;
  const maxTop = window.innerHeight - mapCard.offsetHeight - MAP_MARGIN;
  mapCard.style.left = `${clamp(left, MAP_MARGIN, Math.max(MAP_MARGIN, maxLeft))}px`;
  mapCard.style.top = `${clamp(top, MAP_MARGIN, Math.max(MAP_MARGIN, maxTop))}px`;
}

function startMapDrag(e) {
  if (!mapCard || !mapHeader) return;
  e.preventDefault();

  const rect = mapCard.getBoundingClientRect();
  mapDragState = {
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top
  };
  mapModal.classList.add('is-interacting');
  mapModal.classList.remove('tinted');

  document.addEventListener('mousemove', onMapDrag);
  document.addEventListener('mouseup', stopMapDrag);
}

function onMapDrag(e) {
  if (!mapDragState) return;
  setMapCardPosition(e.clientX - mapDragState.offsetX, e.clientY - mapDragState.offsetY);
}

function stopMapDrag() {
  if (!mapDragState) return;
  mapDragState = null;
  mapModal.classList.remove('is-interacting');
  document.removeEventListener('mousemove', onMapDrag);
  document.removeEventListener('mouseup', stopMapDrag);
}

if (mapHeader) {
  mapHeader.addEventListener('mousedown', startMapDrag);
}

function startMapResize(e) {
  if (!mapCard) return;
  const handle = e.currentTarget;
  const direction = handle?.dataset?.resize;
  if (!direction) return;

  e.preventDefault();
  e.stopPropagation();

  const rect = mapCard.getBoundingClientRect();
  mapResizeState = {
    direction,
    startX: e.clientX,
    startY: e.clientY,
    startWidth: rect.width,
    startHeight: rect.height,
    startLeft: rect.left,
    startTop: rect.top
  };
  mapModal.classList.add('is-interacting');
  mapModal.classList.remove('tinted');

  document.addEventListener('mousemove', onMapResize);
  document.addEventListener('mouseup', stopMapResize);
}

function onMapResize(e) {
  if (!mapResizeState || !mapCard) return;
  const { direction, startX, startY, startWidth, startHeight, startLeft, startTop } = mapResizeState;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  let width = startWidth;
  let height = startHeight;
  let left = startLeft;
  let top = startTop;

  if (direction.includes('e')) {
    width = startWidth + dx;
  }
  if (direction.includes('s')) {
    height = startHeight + dy;
  }
  if (direction.includes('w')) {
    width = startWidth - dx;
  }
  if (direction.includes('n')) {
    height = startHeight - dy;
  }

  const maxWidth = window.innerWidth - MAP_MARGIN * 2;
  const maxHeight = window.innerHeight - MAP_MARGIN * 2;

  width = clamp(width, MAP_MIN_WIDTH, maxWidth);
  height = clamp(height, MAP_MIN_HEIGHT, maxHeight);

  if (direction.includes('w')) {
    left = startLeft + (startWidth - width);
  }
  if (direction.includes('n')) {
    top = startTop + (startHeight - height);
  }

  left = clamp(left, MAP_MARGIN, window.innerWidth - width - MAP_MARGIN);
  top = clamp(top, MAP_MARGIN, window.innerHeight - height - MAP_MARGIN);

  mapCard.style.width = `${width}px`;
  mapCard.style.height = `${height}px`;
  mapCard.style.left = `${left}px`;
  mapCard.style.top = `${top}px`;
}

function stopMapResize() {
  if (!mapResizeState) return;
  mapResizeState = null;
  mapModal.classList.remove('is-interacting');
  document.removeEventListener('mousemove', onMapResize);
  document.removeEventListener('mouseup', stopMapResize);
}

if (mapResizeHandles) {
  mapResizeHandles.forEach(handle => {
    handle.addEventListener('mousedown', startMapResize);
  });
}

if (mapCard && 'ResizeObserver' in window) {
  mapObserver = new ResizeObserver(() => {
    mapModal.classList.add('is-interacting');
    clearTimeout(mapResizeTimer);
    mapResizeTimer = setTimeout(() => {
      mapModal.classList.remove('is-interacting');
    }, 150);
    leafletMap?.invalidateSize();
  });
  mapObserver.observe(mapCard);
}

function centerMapOnPlayers(game) {
  if (!game || !leafletMap) return;

  const points = game.players
    .map(p => {
      const loc = state.players?.[p.playerID]?.location;
      if (!loc?.lat || !loc?.lon) return null;
      return [loc.lat, loc.lon];
    })
    .filter(Boolean);

  if (points.length === 0) return;

  leafletMap.fitBounds(points, { padding: [40, 40] });
}

//Three D View Toggle Button
const threeDBtn = document.getElementById('threedmap-toggle-btn');
const overlay = document.getElementById('threedmap-overlay');
const playerListEl = document.getElementById('threedmap-player-list');
const cancelBtn = document.getElementById('threedmap-cancel');

threeDBtn.addEventListener('click', () => {
  openPlayerSelect();
});

cancelBtn.addEventListener('click', () => {
  closePlayerSelect();
});



function openPlayerSelect() {
  playerListEl.innerHTML = '';
  console.log('state.players =', state.players);
  console.log('Array?', Array.isArray(state.players));

  // Adjust this depending on your actual state shape
  const players = Array.from(playersMapFromState());

  players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'threedmap-player';
    div.textContent = player.playerID;

    div.onclick = () => {
      enter3DView(player.playerID);
    };

    playerListEl.appendChild(div);
  });

  overlay.classList.remove('hidden');
}

function closePlayerSelect() {
  overlay.classList.add('hidden');
}


function playersMapFromState() {
  if (!state || !state.players) return [];
  return Object.entries(state.players).map(([playerID, data]) => ({
    playerID,
    ...data
  }));
}






function show3DPlaceholder() {
  const panel = document.createElement('div');
  panel.id = 'threedmap-root';

  panel.innerHTML = `
    <div id="threedmap-header">
      <div>
        <strong>3D Live View</strong><br>
        Viewing perspective of ${threeDViewPlayerID}
      </div>
      <button id="exit-3d" class="control-btn">Exit</button>
    </div>

    <div id="threedmap-canvas"></div>
  `;

  document.body.appendChild(panel);
  document.getElementById('exit-3d').onclick = exit3DView;
}


function getRelativePlayerPositions(originPlayerID) {
  if (!state || !state.players) return [];

  const origin = state.players[originPlayerID];
  if (!origin || !origin.location) return [];

  const { lat: lat0, lon: lon0, alt: alt0 } = origin.location;
  const lat0Rad = lat0 * Math.PI / 180;

  const METERS_PER_DEG_LAT = 111320;
  const METERS_PER_DEG_LON = 111320 * Math.cos(lat0Rad);

  const results = [];

  for (const [playerID, player] of Object.entries(state.players)) {
    if (!player.location) continue;

    const { lat, lon, alt } = player.location;

    const dx = (lon - lon0) * METERS_PER_DEG_LON; // east / west
    const dz = (lat - lat0) * METERS_PER_DEG_LAT; // north / south
    const dy = (alt ?? 0) - (alt0 ?? 0); // vertical

    results.push({
      playerID,
      relative: {
        x: dx,
        y: dy,
        z: dz
      },
      heading: player.heading ?? null
    });
  }

  return results;
}

setInterval(() => {
  if (!threeDViewActive || !threeDViewPlayerID) return;

  const rel = getRelativePlayerPositions(threeDViewPlayerID);
  console.clear();
  console.table(
    rel.map(p => ({
      id: p.playerID.slice(0, 6),
      x: p.relative.x.toFixed(2),
      y: p.relative.y.toFixed(2),
      z: p.relative.z.toFixed(2)
    }))
  );
}, 500);




/* ----------------------------- RENDER ROOT ----------------------------- */
function render() {
  renderGamesList();
  renderGameDetails();
  renderRawState();

  if (!mapModal.classList.contains('hidden')) {
    renderMapPlayers(state?.games?.[selectedGameID]);
  }
}
/* ----------------------------- GAMES LIST ------------------------------ */

function renderGamesList() {
  const list = document.getElementById('games-list');
  list.innerHTML = '';

  const games = state?.games || {};

  Object.values(games).forEach(game => {
    const li = document.createElement('li');
    li.className = 'game-item' + (game.gameID === selectedGameID ? ' active' : '');
    li.onclick = () => {
      selectedGameID = game.gameID;

      Object.values(playerMarkers).forEach(marker =>
        leafletMap?.removeLayer(marker)
      );
      playerMarkers = {};

      render();
    };

    const id = document.createElement('div');
    id.className = 'game-id';
    id.textContent = game.gameID;

    const meta = document.createElement('div');
    meta.className = 'game-meta';
    meta.textContent = `${game.phase} • ${game.players.length} players`;

    li.appendChild(id);
    li.appendChild(meta);
    list.appendChild(li);

  });
}

/* ----------------------------- GAME DETAILS ----------------------------- */

function renderGameDetails() {
  const game = state?.games?.[selectedGameID];

  setText('detail-game-id', game?.gameID || '—');
  setText('detail-phase', game?.phase || '—');
  setText('detail-radius', game?.circleRadius ?? '—');
  setText(
    'detail-center',
    game?.circleCenter
      ? `${game.circleCenter.lat}, ${game.circleCenter.lng}`
      : '—'
  );
  setText('detail-timer', game?.timer ? 'ACTIVE' : '—');

  renderPlayersTable(game);
}

function renderPlayersTable(game) {
  const tbody = document.getElementById('players-table');
  tbody.innerHTML = '';

  if (!game) return;

  game.players.forEach(player => {
    const tr = document.createElement('tr');

    const livePlayer = state.players?.[player.playerID];

    addCell(tr, player.playerID);
    addCell(tr, player.status);
    addCell(tr, player.isAdmin ? 'YES' : 'NO');

    addCell(tr, livePlayer?.LOCAL_POSITIONS?.x ?? '—');
    addCell(tr, livePlayer?.LOCAL_POSITIONS?.y ?? '—');
    addCell(tr, livePlayer?.LOCAL_POSITIONS?.z ?? '—');

    const socketState =
      state.playerSockets?.[player.playerID] || 'UNKNOWN';
    addCell(tr, socketState);

    tbody.appendChild(tr);
  });
}

/* ----------------------------- RAW STATE -------------------------------- */

function renderRawState() {
  const raw = {
    games: state?.games || {},
    players: state?.players || {},
    playerSockets: state?.playerSockets || {}
  };

  document.getElementById('raw-json').textContent =
    JSON.stringify(raw, null, 2);
}

const copyRawBtn = document.getElementById('copy-raw-btn');
if (copyRawBtn) {
  copyRawBtn.addEventListener('click', async () => {
    const rawEl = document.getElementById('raw-json');
    if (!rawEl) return;

    try {
      await navigator.clipboard.writeText(rawEl.textContent || '');
      copyRawBtn.textContent = 'Copied';
      setTimeout(() => {
        copyRawBtn.textContent = 'Copy';
      }, 1200);
    } catch (err) {
      console.error('Copy raw state failed', err);
    }
  });
}

/* ----------------------------- HELPERS ---------------------------------- */

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = value;

  // Remove old phase classes
  el.classList.remove(
    'phase-LOBBY',
    'phase-HIDE',
    'phase-SEEK',
    'phase-END'
  );

  // Apply new phase class
  if (value) {
    el.classList.add('phase', `phase-${value}`);
  }
}


function addCell(row, text) {
  const td = document.createElement('td');
  td.textContent = text;
  row.appendChild(td);
}
let scene, camera, renderer;
let originSphere;
let playerMeshes = new Map();

function initThreeScene() {
  const container = document.getElementById('threedmap-canvas');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f14);

  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );

  camera.position.set(0, 15, 20);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Grid (critical for perception)
  const grid = new THREE.GridHelper(100, 20, 0x30363d, 0x30363d);
  scene.add(grid);

  // Origin sphere (YOU)
  const geo = new THREE.SphereGeometry(0.6, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2ea043 });
  originSphere = new THREE.Mesh(geo, mat);
  scene.add(originSphere);

  animate();
}
function animate() {
  if (!threeDViewActive) return;
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

function enter3DView(playerID) {
  threeDViewActive = true;
  threeDViewPlayerID = playerID;

  closePlayerSelect();
  show3DPlaceholder();

  setTimeout(initThreeScene, 0); // wait for DOM
}



function exit3DView() {
  threeDViewActive = false;
  threeDViewPlayerID = null;

  playerMeshes.clear();

  renderer?.dispose();
  document.getElementById('threedmap-root')?.remove();
}

function updatePlayerMeshes() {
  if (!threeDViewActive) return;

  const rel = getRelativePlayerPositions(threeDViewPlayerID);

  rel.forEach(p => {
    if (p.playerID === threeDViewPlayerID) return;

    let mesh = playerMeshes.get(p.playerID);
    if (!mesh) {
      const geo = new THREE.SphereGeometry(0.4, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf85149 });
      mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      playerMeshes.set(p.playerID, mesh);
    }

    mesh.position.set(
      p.relative.x,
      p.relative.y,
      p.relative.z
    );
  });
}


//Additional Administrative Functions can be added here-------------------------------------

//createGame()
//makeAdmin()
//kickPlayer()
//endGame()
//adminNotifications()
                                   





/* ----------------------------- BOOT ------------------------------------- */

fetchState();
setInterval(fetchState, REFRESH_INTERVAL);
