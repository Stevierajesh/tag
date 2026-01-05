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
  const livePlayer = state.players?.[player.playerID];
  const sampleLocations = {
    playerID: 'sample-player',
    location: {
      lon: livePlayer?.location?.lon || 0,
      lat: livePlayer?.location?.lat || 0,
      alt: livePlayer?.location?.alt || 0
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

/* ----------------------------- RENDER ROOT ----------------------------- */

function render() {
  renderGamesList();
  renderGameDetails();
  renderRawState();
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
