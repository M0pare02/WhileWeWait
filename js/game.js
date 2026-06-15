// =============================
// CONSTANTS & STATE
// =============================

// Full 8-color palette available to players
const COLOR_PALETTE = [
  { hex: '#FF6B6B', name: 'Coral'  },
  { hex: '#4FC3F7', name: 'Sky'    },
  { hex: '#FFD93D', name: 'Yellow' },
  { hex: '#6BCB77', name: 'Mint'   },
  { hex: '#FF6FD8', name: 'Pink'   },
  { hex: '#FF9F43', name: 'Orange' },
  { hex: '#A78BFA', name: 'Violet' },
  { hex: '#26C6DA', name: 'Teal'   },
];

// Default colors for player slots 1-4
const PLAYER_COLORS = COLOR_PALETTE.slice(0, 4);

const SIZES = {
  quick:    { cols: 4,  rows: 6  },
  standard: { cols: 8,  rows: 12 },
  long:     { cols: 12, rows: 16 },
};

const SIZE_LABELS = { quick: 'Quick', standard: 'Standard', long: 'Long Wait' };

let players = [];
let currentPlayer = 0;
let drawnLines = new Set();
let capturedSquares = {};
let COLS = 8, ROWS = 12;
let selectedSize = 'standard';
let totalSquares = 0;

// =============================
// SETUP
// =============================
function selectSize(el, size) {
  document.querySelectorAll('.size-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedSize = size;
}

// ---- Color picker ----

function swatchesHTML(selectedHex) {
  return COLOR_PALETTE.map(c => `
    <div class="color-swatch${c.hex === selectedHex ? ' selected' : ''}"
         style="background:${c.hex};"
         data-color="${c.hex}"
         title="${c.name}"
         onclick="pickColor(this)"></div>
  `).join('');
}

function playerEntryHTML(idx, hex, name) {
  return `
    <div class="player-row" data-color="${hex}">
      <div class="player-color-dot" style="background:${hex};" onclick="toggleColorPicker(this)">
        <div class="dot-badge">✎</div>
      </div>
      <input class="player-name-input" type="text" placeholder="Player ${idx + 1} name" value="${name}">
      <div class="remove-player" onclick="removePlayer(this)">−</div>
    </div>
    <div class="color-picker-panel">
      <div class="color-picker-inner">${swatchesHTML(hex)}</div>
    </div>
  `;
}

// Called once on DOMContentLoaded to inject pickers into the HTML-defined entries
function initColorPickers() {
  document.querySelectorAll('#player-list .player-entry').forEach(entry => {
    if (entry.querySelector('.color-picker-panel')) return;
    const hex = entry.querySelector('.player-row').dataset.color;
    const panel = document.createElement('div');
    panel.className = 'color-picker-panel';
    panel.innerHTML = `<div class="color-picker-inner">${swatchesHTML(hex)}</div>`;
    entry.appendChild(panel);
  });
}

function toggleColorPicker(dotEl) {
  const entry  = dotEl.closest('.player-entry');
  const panel  = entry.querySelector('.color-picker-panel');
  const isOpen = panel.classList.contains('open');
  closeAllColorPickers();
  if (!isOpen) panel.classList.add('open');
}

function closeAllColorPickers() {
  document.querySelectorAll('.color-picker-panel.open').forEach(p => p.classList.remove('open'));
}

function pickColor(swatchEl) {
  const hex   = swatchEl.dataset.color;
  const entry = swatchEl.closest('.player-entry');
  const row   = entry.querySelector('.player-row');
  const dot   = entry.querySelector('.player-color-dot');

  dot.style.background = hex;
  row.dataset.color = hex;

  entry.querySelectorAll('.color-swatch').forEach(s =>
    s.classList.toggle('selected', s.dataset.color === hex)
  );

  entry.querySelector('.color-picker-panel').classList.remove('open');
}

// ---- Player list management ----

function addPlayer() {
  const list = document.getElementById('player-list');
  const idx  = list.querySelectorAll('.player-entry').length;
  if (idx >= 4) return;
  const hex   = COLOR_PALETTE[idx].hex;
  const entry = document.createElement('div');
  entry.className = 'player-entry';
  entry.innerHTML = playerEntryHTML(idx, hex, `Player ${idx + 1}`);
  list.appendChild(entry);
}

function removePlayer(btn) {
  const list = document.getElementById('player-list');
  if (list.querySelectorAll('.player-entry').length <= 2) return;
  btn.closest('.player-entry').remove();
}

function startGame() {
  closeAllColorPickers();
  const list = document.getElementById('player-list');
  players = [];
  [...list.querySelectorAll('.player-entry')].forEach((entry, i) => {
    const name  = entry.querySelector('input').value.trim() || `Player ${i + 1}`;
    const color = entry.querySelector('.player-row').dataset.color || COLOR_PALETTE[i].hex;
    players.push({ name, color, score: 0 });
  });
  currentPlayer = 0;

  const sz = SIZES[selectedSize];
  COLS = sz.cols;
  ROWS = sz.rows;
  totalSquares = (COLS - 1) * (ROWS - 1);

  drawnLines = new Set();
  capturedSquares = {};

  document.getElementById('game-size-label').textContent = SIZE_LABELS[selectedSize];
  buildScoreBar();

  // Show the screen first so the board-area has real dimensions, then measure + build
  showScreen('game');
  requestAnimationFrame(buildBoard);
}

// =============================
// SCORE BAR
// =============================
function buildScoreBar() {
  const bar = document.getElementById('score-bar');
  bar.innerHTML = players.map((p, i) => `
    <div class="score-chip p${i + 1} ${i === 0 ? 'active-player' : ''}" id="chip-${i}">
      <div class="chip-left">
        <div class="chip-dot" style="background:${p.color}"></div>
        <div class="chip-name">${p.name.split(' ')[0]}</div>
      </div>
      <div class="chip-score" id="chip-score-${i}">0</div>
    </div>
  `).join('');
  updateTurnIndicator();
}

function updateScoreBar() {
  players.forEach((p, i) => {
    document.getElementById('chip-score-' + i).textContent = p.score;
    document.getElementById('chip-' + i).classList.toggle('active-player', i === currentPlayer);
  });
  updateTurnIndicator();
}

function updateTurnIndicator() {
  const p = players[currentPlayer];
  const dot = document.getElementById('turn-dot');
  dot.style.background = p.color;
  dot.style.boxShadow = `0 0 0 3px ${p.color}44`;
  const nameEl = document.getElementById('turn-name');
  nameEl.textContent = p.name + "'s";
  nameEl.style.color = p.color;
}

// =============================
// BOARD RENDERING
// =============================
let CELL, PAD, DOT_R, SVG_W, SVG_H;

function buildBoard() {
  const area = document.querySelector('.board-area');

  // Subtract the area's own padding (8px each side = 16px total per axis)
  const availW = area.clientWidth  - 16;
  const availH = area.clientHeight - 16;

  // Cell size that fills whichever axis is the bottleneck
  CELL   = Math.min(availW / (COLS - 1), availH / (ROWS - 1));
  DOT_R  = Math.max(3, Math.min(6, CELL * 0.11));
  PAD    = DOT_R + 4;
  SVG_W  = PAD * 2 + (COLS - 1) * CELL;
  SVG_H  = PAD * 2 + (ROWS - 1) * CELL;

  const svg = document.getElementById('game-svg');
  svg.setAttribute('width',  SVG_W);
  svg.setAttribute('height', SVG_H);
  svg.innerHTML = '';

  // Layer order: squares → drawn lines → hover preview → dots on top
  const squaresG = svgG('squares-layer');
  const linesG   = svgG('lines-layer');
  const hoverG   = svgG('hover-layer');
  const dotsG    = svgG('dots-layer');
  svg.append(squaresG, linesG, hoverG, dotsG);

  const dotColor = getComputedStyle(document.documentElement).getPropertyValue('--dot-fill').trim();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', dotX(c));
      dot.setAttribute('cy', dotY(r));
      dot.setAttribute('r',  DOT_R);
      dot.setAttribute('fill', dotColor);
      dotsG.appendChild(dot);
    }
  }

  drawLineZones(hoverG);
}

function svgG(id) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.id = id;
  return g;
}

function dotX(c) { return PAD + c * CELL; }
function dotY(r) { return PAD + r * CELL; }

function lineKey(r1, c1, r2, c2) {
  if (r1 > r2 || (r1 === r2 && c1 > c2)) return `${r2},${c2},${r1},${c1}`;
  return `${r1},${c1},${r2},${c2}`;
}

function drawLineZones(hoverG) {
  // Horizontal segments
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      addLineZone(hoverG, dotX(c), dotY(r), dotX(c + 1), dotY(r), lineKey(r, c, r, c + 1));
    }
  }
  // Vertical segments
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS; c++) {
      addLineZone(hoverG, dotX(c), dotY(r), dotX(c), dotY(r + 1), lineKey(r, c, r + 1, c));
    }
  }
}

function addLineZone(parent, x1, y1, x2, y2, key) {
  const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hit.setAttribute('x1', x1); hit.setAttribute('y1', y1);
  hit.setAttribute('x2', x2); hit.setAttribute('y2', y2);
  hit.setAttribute('stroke', 'transparent');
  hit.setAttribute('stroke-width', Math.max(CELL * 0.65, 16));
  hit.setAttribute('stroke-linecap', 'round');
  hit.style.cursor = 'pointer';

  hit.addEventListener('mouseenter', () => { if (!drawnLines.has(key)) showHoverLine(x1, y1, x2, y2, key); });
  hit.addEventListener('mouseleave', clearHoverLine);
  hit.addEventListener('click',      () => drawLine(key, x1, y1, x2, y2));
  hit.addEventListener('touchstart', (e) => { e.preventDefault(); drawLine(key, x1, y1, x2, y2); }, { passive: false });

  parent.appendChild(hit);
}

let hoverLineEl = null;

function showHoverLine(x1, y1, x2, y2, key) {
  clearHoverLine();
  if (drawnLines.has(key)) return;
  hoverLineEl = makeLine(x1, y1, x2, y2, players[currentPlayer].color + '55');
  document.getElementById('hover-layer').prepend(hoverLineEl);
}

function clearHoverLine() {
  if (hoverLineEl) { hoverLineEl.remove(); hoverLineEl = null; }
}

function makeLine(x1, y1, x2, y2, color) {
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', x1); l.setAttribute('y1', y1);
  l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  l.setAttribute('stroke', color);
  l.setAttribute('stroke-width', Math.max(3, CELL * 0.16));
  l.setAttribute('stroke-linecap', 'round');
  return l;
}

// =============================
// GAME LOGIC
// =============================
function drawLine(key, x1, y1, x2, y2) {
  if (drawnLines.has(key)) return;
  clearHoverLine();

  drawnLines.add(key);
  const p = players[currentPlayer];
  document.getElementById('lines-layer').appendChild(makeLine(x1, y1, x2, y2, p.color));

  const captured = checkCaptures(key);

  if (captured.length > 0) {
    captured.forEach(sq => {
      capturedSquares[sq] = currentPlayer;
      players[currentPlayer].score++;
      drawSquare(sq, p.color);
    });
    updateScoreBar();

    if (captured.length >= 3) showToast('😤', 'Greedy! 3 squares in one go!');

    if (Object.keys(capturedSquares).length >= totalSquares) {
      setTimeout(() => {
        const winner = players.indexOf(players.reduce((a, b) => a.score > b.score ? a : b));
        showVictory(winner);
      }, 600);
    }
  } else {
    currentPlayer = (currentPlayer + 1) % players.length;
    updateScoreBar();
  }
}

function squareKey(r, c) { return `sq-${r}-${c}`; }

function checkCaptures(newKey) {
  const [r1, c1, r2, c2] = newKey.split(',').map(Number);
  const captured = [];

  if (r1 === r2) {
    // Horizontal line — check square above and below
    const minC = Math.min(c1, c2);
    if (r1 > 0      && isSquareComplete(r1 - 1, minC)) captured.push(squareKey(r1 - 1, minC));
    if (r1 < ROWS-1 && isSquareComplete(r1,     minC)) captured.push(squareKey(r1,     minC));
  } else {
    // Vertical line — check square left and right
    const minR = Math.min(r1, r2);
    if (c1 > 0      && isSquareComplete(minR, c1 - 1)) captured.push(squareKey(minR, c1 - 1));
    if (c1 < COLS-1 && isSquareComplete(minR, c1))     captured.push(squareKey(minR, c1));
  }

  return captured.filter(k => !capturedSquares[k]);
}

function isSquareComplete(r, c) {
  return drawnLines.has(lineKey(r,   c,   r,   c+1)) &&  // top
         drawnLines.has(lineKey(r+1, c,   r+1, c+1)) &&  // bottom
         drawnLines.has(lineKey(r,   c,   r+1, c))   &&  // left
         drawnLines.has(lineKey(r,   c+1, r+1, c+1));    // right
}

function drawSquare(sk, color) {
  const [r, c] = sk.replace('sq-', '').split('-').map(Number);
  const inset = Math.max(2, CELL * 0.06);
  const x    = dotX(c) + inset;
  const y    = dotY(r) + inset;
  const size = CELL - inset * 2;

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x',      x);
  rect.setAttribute('y',      y);
  rect.setAttribute('width',  size);
  rect.setAttribute('height', size);
  rect.setAttribute('rx',     Math.max(2, CELL * 0.06));
  rect.setAttribute('fill',   color + 'AA');
  rect.style.animation = 'squarePop 0.3s ease both';
  document.getElementById('squares-layer').appendChild(rect);
}

// Rebuild the board if the window is resized (e.g. orientation change)
window.addEventListener('resize', () => {
  if (document.getElementById('screen-game').classList.contains('active')) {
    buildBoard();
  }
});
