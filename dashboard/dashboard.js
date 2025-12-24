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
    setServerOnline();
    render();
  } catch (err) {
    setServerOffline();
    console.error('Dashboard fetch failed', err);
  }
}


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

    addCell(tr, player.playerID);
    addCell(tr, player.status);
    addCell(tr, player.isAdmin ? 'YES' : 'NO');

    addCell(tr, player.location?.lat ?? '—');
    addCell(tr, player.location?.lon ?? '—');
    addCell(tr, player.location?.alt ?? '—');

    const socketState = state.playerSockets?.[player.playerID] || 'UNKNOWN';
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
  document.getElementById(id).textContent = value;
}

function addCell(row, text) {
  const td = document.createElement('td');
  td.textContent = text;
  row.appendChild(td);
}

/* ----------------------------- BOOT ------------------------------------- */

fetchState();
setInterval(fetchState, REFRESH_INTERVAL);
