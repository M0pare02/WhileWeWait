// Grid Grab setup screen

const PALETTE = ['#FF6B6B', '#45B7D1', '#FFC947', '#4ECDC4', '#FF6B9D', '#98D856'];

const SIZES = {
  small:  { cols: 4, rows: 5 },
  medium: { cols: 5, rows: 6 },
  large:  { cols: 6, rows: 8 },
};

let players = [
  { name: 'Player 1', color: PALETTE[0] },
  { name: 'Player 2', color: PALETTE[1] },
];
let selectedSize = 'small';
let activeSwatchIndex = null;

// ─── Rendering ────────────────────────────────────────

function renderPlayers() {
  const list = document.getElementById('playerList');
  list.innerHTML = '';

  players.forEach((player, i) => {
    const row = document.createElement('div');
    row.className = 'gg-player-row';
    row.dataset.playerIndex = i;

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

document.getElementById('playBtn').addEventListener('click', () => {
  const size = SIZES[selectedSize];
  const config = {
    cols: size.cols,
    rows: size.rows,
    players: players.map(p => ({ name: p.name.trim() || 'Player', color: p.color })),
  };
  try { sessionStorage.setItem('gg_config', JSON.stringify(config)); } catch (_) {}
  location.href = 'game.html';
});

// ─── Helpers ──────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────

renderPlayers();
