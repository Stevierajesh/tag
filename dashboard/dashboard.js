const REFRESH_INTERVAL = 1000;

let state = null;
let selectedGameID = null;

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
  mapToggleBtn.classList.add('active');

  if (!leafletMap) initMap();

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

    addCell(tr, livePlayer?.location?.lon ?? '—');
    addCell(tr, livePlayer?.location?.lat ?? '—');
    addCell(tr, livePlayer?.location?.alt ?? '—');

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

/* ----------------------------- BOOT ------------------------------------- */

fetchState();
setInterval(fetchState, REFRESH_INTERVAL);
