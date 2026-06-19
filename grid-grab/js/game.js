// Grid Grab game screen

(function () {

  // ─── Load config ──────────────────────────────────────

  const config = JSON.parse(sessionStorage.getItem('gg_config') || 'null');
  if (!config) { location.href = 'setup.html'; return; }

  let state = GGEngine.initState(config);

  // Canvas context + geometry
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  let cellSize = 0;
  let offsetX  = 0;
  let offsetY  = 0;
  let dpr      = window.devicePixelRatio || 1;

  // Pending animations: [{kind, row, col, progress, resolve}]
  let lineAnims = [];
  let boxAnims  = [];
  let animFrame = null;
  let animating = false;

  // ─── Canvas init ──────────────────────────────────────

  function initCanvas() {
    const wrap = document.getElementById('canvasWrap');
    const rect = wrap.getBoundingClientRect();
    const availW = rect.width  - 50; 
    const availH = rect.height - 50;

    cellSize = Math.min(
      availW / (state.cols - 1),
      availH / (state.rows - 1)
    );

    const gridW = cellSize * (state.cols - 1);
    const gridH = cellSize * (state.rows - 1);

    const cssW = gridW + 50;
    const cssH = gridH + 50;
    offsetX = 25;
    offsetY = 25;

    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.scale(dpr, dpr);
  }

  // ─── Rendering ────────────────────────────────────────

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoxFills();
    drawLines();
    drawDots();
  }

  function dotX(col) { return offsetX + col * cellSize; }
  function dotY(row) { return offsetY + row * cellSize; }

  function drawBoxFills() {
    for (let r = 0; r < state.rows - 1; r++) {
      for (let c = 0; c < state.cols - 1; c++) {
        const owner = state.boxes[r * (state.cols - 1) + c];
        if (owner === -1) continue;
        ctx.fillStyle = hexToRgba(state.players[owner].color, 0.35);
        ctx.beginPath();
        ctx.rect(
          dotX(c) + 1, dotY(r) + 1,
          cellSize - 2, cellSize - 2
        );
        ctx.fill();
      }
    }

    // Overlay box-fill animations (fading in)
    for (const anim of boxAnims) {
      const alpha = 0.35 * anim.progress;
      ctx.fillStyle = hexToRgba(state.players[anim.playerIdx].color, alpha);
      ctx.beginPath();
      ctx.rect(
        dotX(anim.col) + 1, dotY(anim.row) + 1,
        cellSize - 2, cellSize - 2
      );
      ctx.fill();
    }
  }

  function drawLines() {
    const { cols, rows, hLines, vLines, players } = state;

    // Horizontal lines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const drawn = hLines[r * (cols - 1) + c];
        const x1 = dotX(c);
        const y1 = dotY(r);
        const x2 = dotX(c + 1);
        drawLineSegment(x1, y1, x2, y1, drawn, null);
      }
    }

    // Vertical lines
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        const drawn = vLines[r * cols + c];
        const x1 = dotX(c);
        const y1 = dotY(r);
        const y2 = dotY(r + 1);
        drawLineSegment(x1, y1, x1, y2, drawn, null);
      }
    }

    // Animated lines on top
    for (const anim of lineAnims) {
      const p = anim.progress;
      const x1 = dotX(anim.c1), y1 = dotY(anim.r1);
      const x2 = dotX(anim.c2), y2 = dotY(anim.r2);
      const ex = x1 + (x2 - x1) * p;
      const ey = y1 + (y2 - y1) * p;
      ctx.strokeStyle = state.players[anim.playerIdx].color;
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  function drawLineSegment(x1, y1, x2, y2, drawn, _override) {
    if (drawn > 0) {
      ctx.strokeStyle = state.players[drawn - 1].color;
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(107, 78, 255, 0.2)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawDots() {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(dotX(c), dotY(r), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ─── UI Updates ──────────────────────────────────────

  function updateScoreBar() {
    const bar = document.getElementById('scoreBar');
    bar.innerHTML = '';
    state.players.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'gg-score-chip' + (i === state.currentPlayer ? ' gg-score-chip--active' : '');
      chip.innerHTML = `
        <span class="gg-score-chip__dot" style="background:${p.color}"></span>
        <span class="gg-score-chip__name">${escapeHtml(p.name)}</span>
        <span class="gg-score-chip__score">${state.scores[i]}</span>
      `;
      bar.appendChild(chip);
    });
  }

  function updateTurnIndicator() {
    const p = state.players[state.currentPlayer];
    const el = document.getElementById('turnIndicator');
    el.innerHTML = `<span><strong style="color:${p.color}">${escapeHtml(p.name)}</strong>'s turn</span>`;
  }

  // ─── Animation Loop ──────────────────────────────────

  function startAnimLoop() {
    if (animFrame) return;
    let last = null;

    function tick(ts) {
      if (!last) last = ts;
      const dt = ts - last;
      last = ts;

      let anyActive = false;

      for (const anim of lineAnims) {
        anim.progress = Math.min(1, anim.progress + dt / 150);
        if (anim.progress < 1) anyActive = true;
      }

      for (const anim of boxAnims) {
        anim.progress = Math.min(1, anim.progress + dt / 200);
        if (anim.progress < 1) anyActive = true;
      }

      render();

      // Remove completed animations and resolve their promises
      lineAnims = lineAnims.filter(a => {
        if (a.progress >= 1) { a.resolve(); return false; }
        return true;
      });
      boxAnims = boxAnims.filter(a => {
        if (a.progress >= 1) { a.resolve(); return false; }
        return true;
      });

      if (anyActive || lineAnims.length || boxAnims.length) {
        animFrame = requestAnimationFrame(tick);
      } else {
        animFrame = null;
      }
    }

    animFrame = requestAnimationFrame(tick);
  }

  function animateLineDraw(kind, row, col, playerIdx) {
    return new Promise(resolve => {
      let r1, c1, r2, c2;
      if (kind === 'h') {
        r1 = row; c1 = col; r2 = row; c2 = col + 1;
      } else {
        r1 = row; c1 = col; r2 = row + 1; c2 = col;
      }
      lineAnims.push({ r1, c1, r2, c2, playerIdx, progress: 0, resolve });
      startAnimLoop();
    });
  }

  function animateBoxFills(boxes, playerIdx) {
    if (boxes.length === 0) return Promise.resolve();
    return new Promise(resolve => {
      let remaining = boxes.length;
      for (const { row, col } of boxes) {
        const anim = {
          row, col, playerIdx, progress: 0,
          resolve: () => { if (--remaining === 0) resolve(); }
        };
        boxAnims.push(anim);
      }
      startAnimLoop();
    });
  }

  // ─── Input Handling ───────────────────────────────────

  canvas.addEventListener('pointerdown', handlePointerDown);

  async function handlePointerDown(e) {
    if (animating) return;

    const rect  = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / (rect.width  * dpr);
    const scaleY = canvas.height / (rect.height * dpr);
    const px = (e.clientX - rect.left) * scaleX / dpr;
    const py = (e.clientY - rect.top)  * scaleY / dpr;

    const line = findNearestLine(px, py);
    if (!line) return;

    animating = true;

    const drawingPlayer = state.currentPlayer;
    const result = GGEngine.tryClaimLine(state, line.kind, line.row, line.col);
    if (!result) { animating = false; return; }

    await animateLineDraw(line.kind, line.row, line.col, drawingPlayer);
    await animateBoxFills(result.completedBoxes, drawingPlayer);

    updateScoreBar();
    updateTurnIndicator();
    render();

    animating = false;

    if (result.gameOver) {
      setTimeout(() => showWinnerOverlay(), 400);
    }
  }

  function findNearestLine(px, py) {
    const gx = (px - offsetX) / cellSize;
    const gy = (py - offsetY) / cellSize;

    const fracX = gx - Math.floor(gx);
    const fracY = gy - Math.floor(gy);

    const nearRowH = Math.abs(fracY) < 0.35 || Math.abs(fracY - 1) < 0.35;
    const nearColV = Math.abs(fracX) < 0.35 || Math.abs(fracX - 1) < 0.35;
    const midX = fracX > 0.15 && fracX < 0.85;
    const midY = fracY > 0.15 && fracY < 0.85;

    const hCandidate = nearRowH && midX;
    const vCandidate = nearColV && midY;

    const distToHLine = Math.min(Math.abs(fracY), Math.abs(fracY - 1));
    const distToVLine = Math.min(Math.abs(fracX), Math.abs(fracX - 1));

    let kind, row, col;

    if (hCandidate && (!vCandidate || distToHLine <= distToVLine)) {
      kind = 'h';
      row  = Math.round(gy);
      col  = Math.floor(gx);
    } else if (vCandidate) {
      kind = 'v';
      row  = Math.floor(gy);
      col  = Math.round(gx);
    } else {
      return null;
    }

    // Bounds check
    if (kind === 'h') {
      if (row < 0 || row >= state.rows || col < 0 || col >= state.cols - 1) return null;
    } else {
      if (row < 0 || row >= state.rows - 1 || col < 0 || col >= state.cols) return null;
    }

    return { kind, row, col };
  }

  // ─── Winner Screen ────────────────────────────────────

  function showWinnerOverlay() {
    const result = GGEngine.determineWinner(state);
    const overlay = document.getElementById('winnerOverlay');
    const headline = document.getElementById('winnerHeadline');

    if (result.winners.length === 1) {
      const w = state.players[result.winners[0]];
      headline.textContent = `${w.name} Wins!`;
      headline.style.color = w.color;
    } else {
      const names = result.winners.map(i => state.players[i].name).join(' & ');
      headline.textContent = `It's a Tie!`;
      headline.style.color = 'var(--gold)';
    }

    const scoresEl = document.getElementById('winnerScores');
    scoresEl.innerHTML = '';
    result.ranked.forEach(({ idx, score }) => {
      const p = state.players[idx];
      const isWinner = result.winners.includes(idx);
      const row = document.createElement('div');
      row.className = 'gg-winner-score-row' + (isWinner ? ' gg-winner-score-row--winner' : '');
      row.innerHTML = `
        <span class="gg-winner-score-row__dot" style="background:${p.color}"></span>
        <span class="gg-winner-score-row__name">${escapeHtml(p.name)}</span>
        <span class="gg-winner-score-row__score">${score}</span>
      `;
      scoresEl.appendChild(row);
    });

    overlay.hidden = false;
  }

  document.getElementById('playAgainBtn').addEventListener('click', () => {
    state = GGEngine.initState(config);
    document.getElementById('winnerOverlay').hidden = true;
    lineAnims = [];
    boxAnims  = [];
    updateScoreBar();
    updateTurnIndicator();
    render();
  });

  document.getElementById('homeBtn').addEventListener('click', () => {
    location.href = '../index.html';
  });

  document.getElementById('quitBtn').addEventListener('click', () => {
    if (state.filledBoxes > 0 && document.getElementById('winnerOverlay').hidden) {
      if (!confirm('Quit this game?')) return;
    }
    location.href = '../index.html';
  });

  // ─── Helpers ──────────────────────────────────────────

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  // ─── Boot ─────────────────────────────────────────────

  initCanvas();
  updateScoreBar();
  updateTurnIndicator();
  render();

  window.addEventListener('resize', () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    initCanvas();
    render();
  });

})();
