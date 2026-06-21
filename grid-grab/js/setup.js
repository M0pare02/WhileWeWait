// Grid Grab setup screen

const PALETTE = ['#FF6B6B', '#45B7D1', '#FFC947', '#A855F7', '#FF6B9D', '#98D856'];

const SIZES = {
  small:  { cols: 3, rows: 5 },
  medium: { cols: 4, rows: 7 },
  large:  { cols: 5, rows: 9 },
};

let players = [
  { name: 'Player 1', color: PALETTE[0] },
  { name: 'Player 2', color: PALETTE[1] },
];
let selectedSize = 'small';
let activeSwatchIndex = null;
let mode = 'local'; // 'local' = pass & play, 'online' = each on own phone

// ─── Rendering ────────────────────────────────────────

function renderPlayers() {
  const list = document.getElementById('playerList');
  list.innerHTML = '';

  players.forEach((player, i) => {
    const row = document.createElement('div');
    row.className = 'gg-player-row';
    row.dataset.playerIndex = i;

    // In online mode only the host (seat 0) is editable here — the other seats
    // are filled by players joining from their own phones in the lobby.
    if (mode === 'online' && i > 0) {
      row.classList.add('gg-player-row--remote');
      row.innerHTML = `
        <button class="gg-color-swatch" style="background:${player.color}" disabled aria-hidden="true"></button>
        <span class="gg-remote-label">Joins from their phone…</span>
      `;
      list.appendChild(row);
      return;
    }

    row.innerHTML = `
      <button class="gg-color-swatch" style="background:${player.color}"
              aria-label="Change color for player ${i + 1}" data-index="${i}">
        <span class="gg-pencil-icon">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 1L9 3L3.5 8.5L1 9L1.5 6.5L7 1Z" stroke="#9B8EC4" stroke-width="1.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>
      <input class="gg-player-name" type="text" value="${escapeHtml(player.name)}"
             maxlength="16" aria-label="Name for player ${i + 1}" data-index="${i}">
    `;

    list.appendChild(row);
  });

  // Bind swatch buttons
  list.querySelectorAll('.gg-color-swatch').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.disabled) return;
      const idx = parseInt(btn.dataset.index);
      openPopover(idx);
    });
  });

  // Bind name inputs
  list.querySelectorAll('.gg-player-name').forEach(input => {
    input.addEventListener('input', e => {
      const idx = parseInt(input.dataset.index);
      players[idx].name = input.value;
    });
  });

  updateCountButtons();
}

function updateCountButtons() {
  document.getElementById('removePlayer').disabled = players.length <= 2;
  document.getElementById('addPlayer').disabled = players.length >= 4;
  document.getElementById('playerCountDisplay').textContent = players.length;
}

// ─── Color Popover ─────────────────────────────────────

function openPopover(playerIndex) {
  activeSwatchIndex = playerIndex;
  const popover = document.getElementById('colorPopover');

  // Mark currently selected color
  popover.querySelectorAll('.gg-color-option').forEach(btn => {
    btn.classList.toggle('gg-color-option--selected', btn.dataset.color === players[playerIndex].color);
  });

  popover.hidden = false;
}

function closePopover() {
  document.getElementById('colorPopover').hidden = true;
  activeSwatchIndex = null;
}

// ─── Mode Toggle ──────────────────────────────────────

function applyMode() {
  const isOnline = mode === 'online';
  document.getElementById('playersLabel').textContent = isOnline ? 'You + players' : 'Players';
  document.getElementById('playBtn').textContent = isOnline ? 'Create Room' : 'Play!';
  renderPlayers();
}

document.querySelectorAll('.gg-mode-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gg-mode-option').forEach(b => {
      b.classList.remove('gg-mode-option--active');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('gg-mode-option--active');
    btn.setAttribute('aria-checked', 'true');
    mode = btn.dataset.mode;
    applyMode();
  });
});

// ─── Size Picker ──────────────────────────────────────

document.querySelectorAll('.gg-size-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gg-size-option').forEach(b => {
      b.classList.remove('gg-size-option--active');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('gg-size-option--active');
    btn.setAttribute('aria-checked', 'true');
    selectedSize = btn.dataset.size;
  });
});

// ─── Add / Remove Players ─────────────────────────────

document.getElementById('addPlayer').addEventListener('click', () => {
  if (players.length >= 4) return;
  const nextColor = PALETTE.find(c => !players.some(p => p.color === c)) || PALETTE[players.length];
  players.push({ name: `Player ${players.length + 1}`, color: nextColor });
  renderPlayers();
});

document.getElementById('removePlayer').addEventListener('click', () => {
  if (players.length <= 2) return;
  players.pop();
  renderPlayers();
});

// ─── Color Option Selection ────────────────────────────

document.getElementById('colorPopover').querySelectorAll('.gg-color-option').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (activeSwatchIndex === null) return;
    players[activeSwatchIndex].color = btn.dataset.color;
    closePopover();
    renderPlayers();
  });
});

// Dismiss popover on outside tap
document.addEventListener('click', () => closePopover());

// ─── Play Button ──────────────────────────────────────

document.getElementById('playBtn').addEventListener('click', async () => {
  const size = SIZES[selectedSize];

  // Pass & play — unchanged offline flow.
  if (mode === 'local') {
    const config = {
      cols: size.cols,
      rows: size.rows,
      players: players.map(p => ({ name: p.name.trim() || 'Player', color: p.color })),
    };
    try { sessionStorage.setItem('gg_config', JSON.stringify(config)); } catch (_) {}
    location.href = 'game.html';
    return;
  }

  // Online — create a room with the host as seat 0, then go to the lobby.
  const btn = document.getElementById('playBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const host = { name: players[0].name.trim() || 'Player 1', color: players[0].color };
    const data = await GGNet.createRoom({ cols: size.cols, rows: size.rows }, players.length, host);
    GGNet.set({ code: data.code, token: data.token, seat: 0, host: true });
    location.href = `lobby.html?room=${data.code}`;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Create Room';
    console.error('createRoom failed:', e);
    alert('Could not create room — ' + (e.message || 'unknown error') + '. Check the browser console for details.');
  }
});

// ─── Helpers ──────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────

renderPlayers();
