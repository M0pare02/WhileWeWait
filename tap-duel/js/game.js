(function () {

  // ─── Load config / resume ────────────────────────────
  var savedResume = null;
  try { savedResume = JSON.parse(localStorage.getItem('td_resume') || 'null'); } catch (_) {}

  var config = null;
  if (savedResume && savedResume.config && savedResume.state) {
    config = savedResume.config;
  } else {
    try { config = JSON.parse(sessionStorage.getItem('td_config') || 'null'); } catch (_) {}
  }

  if (!config || !config.players || config.players.length < 2) {
    location.href = 'setup.html';
    return;
  }

  // ─── State ───────────────────────────────────────────
  var state = (savedResume && savedResume.state)
    ? TDEngine.deserialize(savedResume.state)
    : TDEngine.initState(config);
  var phase = 'idle';
  var tapTimes = []; // per playerIdx: null | number(ms) | 'false-start'
  var flashTime = null;

  var countdownTimer = null;
  var waitTimer = null;
  var collectTimer = null;
  var stopwatchInterval = null;
  var stopwatchStart = null;

  // ─── Build arena ─────────────────────────────────────

  function buildArena() {
    var arena = document.getElementById('tdArena');
    arena.innerHTML = '';
    var n = state.players.length;
    if (n === 2) {
      arena.appendChild(makeRow([{idx: 1, flip: true}]));
      arena.appendChild(makeRow([{idx: 0, flip: false}]));
    } else if (n === 3) {
      arena.appendChild(makeRow([{idx: 1, flip: true}, {idx: 2, flip: true}]));
      arena.appendChild(makeRow([{idx: 0, flip: false}]));
    } else {
      arena.appendChild(makeRow([{idx: 1, flip: true}, {idx: 3, flip: true}]));
      arena.appendChild(makeRow([{idx: 0, flip: false}, {idx: 2, flip: false}]));
    }
  }

  function makeRow(entries) {
    var row = document.createElement('div');
    row.className = 'td-row';
    entries.forEach(function (e) { row.appendChild(makeZone(e.idx, e.flip)); });
    return row;
  }

  function makeZone(pi, flip) {
    var p = state.players[pi];

    var zone = document.createElement('div');
    zone.className = 'td-player-zone' + (flip ? ' td-player-zone--flipped' : '');
    zone.style.background = hexToRgba(p.color, 0.07);

    // Label area: name + win dots
    var labelArea = document.createElement('div');
    labelArea.className = 'td-label-area';

    var nameEl = document.createElement('div');
    nameEl.className = 'td-player-name';
    nameEl.textContent = p.name;

    var dotsEl = document.createElement('div');
    dotsEl.className = 'td-win-dots';
    dotsEl.id = 'td-dots-' + pi;

    labelArea.appendChild(nameEl);
    labelArea.appendChild(dotsEl);

    // Tap button
    var btn = document.createElement('button');
    btn.className = 'td-tap-btn td-tap-btn--idle';
    btn.id = 'td-btn-' + pi;
    btn.setAttribute('aria-label', p.name + ' tap button');
    btn.style.backgroundColor = hexToRgba(p.color, 0.45);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('pointerdown', (function (playerIdx) {
      return function (e) { e.preventDefault(); onTap(playerIdx); };
    })(pi));

    // Status text
    var statusEl = document.createElement('div');
    statusEl.className = 'td-status td-status--normal';
    statusEl.id = 'td-status-' + pi;

    zone.appendChild(labelArea);
    zone.appendChild(btn);
    zone.appendChild(statusEl);

    return zone;
  }

  // ─── Game flow ───────────────────────────────────────

  function startCountdown() {
    phase = 'countdown';
    flashTime = null;
    tapTimes = new Array(state.players.length).fill(null);

    state.players.forEach(function (p, i) {
      setBtn(i, 'idle', p);
      setStatus(i, '', 'normal');
      updateDots(i);
    });

    var n = 3;
    (function tick() {
      if (n > 0) {
        state.players.forEach(function (p, i) { setStatus(i, String(n), 'countdown'); });
        n--;
        countdownTimer = setTimeout(tick, 1000);
      } else {
        state.players.forEach(function (p, i) { setStatus(i, 'GO!', 'countdown'); });
        countdownTimer = setTimeout(function () {
          state.players.forEach(function (p, i) { setStatus(i, '', 'normal'); });
          startWaiting();
        }, 700);
      }
    })();
  }

  function startWaiting() {
    phase = 'waiting';
    state.players.forEach(function (p, i) {
      if (tapTimes[i] !== 'false-start') setBtn(i, 'ready', p);
    });

    stopwatchStart = Date.now();
    stopwatchInterval = setInterval(function () {
      var s = ((Date.now() - stopwatchStart) / 1000).toFixed(1);
      state.players.forEach(function (p, i) {
        if (tapTimes[i] === null) setStatus(i, s + 's', 'stopwatch');
      });
    }, 50);

    var delay = 1000 + Math.random() * 4000;
    waitTimer = setTimeout(triggerFlash, delay);
  }

  function triggerFlash() {
    clearInterval(stopwatchInterval);
    phase = 'flash';
    flashTime = Date.now();
    state.players.forEach(function (p, i) {
      if (tapTimes[i] !== 'false-start') {
        setBtn(i, 'signal', p);
        setStatus(i, '', 'normal');
      }
    });
    collectTimer = setTimeout(finalizeRound, 3000);
  }

  // ─── Tap handling ─────────────────────────────────────

  function onTap(pi) {
    if (tapTimes[pi] !== null) return;

    if (phase === 'waiting') {
      tapTimes[pi] = 'false-start';
      setBtn(pi, 'false-start', state.players[pi]);
      setStatus(pi, 'TOO EARLY', 'error');

      var remaining = tapTimes.filter(function (t) { return t === null; }).length;
      if (remaining === 0) {
        clearTimeout(waitTimer);
        clearInterval(stopwatchInterval);
        // All players false-started — skip the flash and resolve immediately
        countdownTimer = setTimeout(finalizeRound, 500);
      }
      return;
    }

    if (phase !== 'flash' && phase !== 'collecting') return;
    phase = 'collecting';

    var ms = Date.now() - flashTime;
    tapTimes[pi] = ms;
    setBtn(pi, 'done', state.players[pi]);
    setStatus(pi, ms + 'ms', 'reaction');

    var pending = tapTimes.filter(function (t) { return t === null; }).length;
    if (pending === 0) {
      clearTimeout(collectTimer);
      finalizeRound();
    }
  }

  // ─── Round resolution ─────────────────────────────────

  function finalizeRound() {
    phase = 'result';
    clearTimeout(collectTimer);
    clearInterval(stopwatchInterval);

    var roundNum = state.currentRound;
    var engineTimes = tapTimes.map(function (t) { return t === 'false-start' ? null : t; });
    var result = TDEngine.resolveRound(state, engineTimes);
    result.roundNum = roundNum;

    state.players.forEach(function (p, i) { updateDots(i); });
    showRoundResult(result);
  }

  // ─── Overlays ─────────────────────────────────────────

  function showRoundResult(result) {
    var winnerIdxs = result.winnerIdxs;

    var headline;
    if (winnerIdxs.length === 0) headline = 'No winner';
    else if (winnerIdxs.length === 1) headline = state.players[winnerIdxs[0]].name + ' wins the round!';
    else headline = 'Tie!';

    var scoresHtml = state.players.map(function (p, i) {
      var t = tapTimes[i];
      var timeStr = t === 'false-start' ? 'Too early' : typeof t === 'number' ? t + 'ms' : '—';
      var isWinner = winnerIdxs.indexOf(i) >= 0;
      return '<div class="td-result-row' + (isWinner ? ' td-result-row--winner' : '') + '">' +
        '<span class="td-result-dot" style="background:' + p.color + '"></span>' +
        '<span class="td-result-name">' + esc(p.name) + '</span>' +
        '<span class="td-result-time">' + timeStr + '</span>' +
        '</div>';
    }).join('');

    var btnText = result.gameOver ? 'Final Results' : 'Next Round →';
    var btnId = 'tdNextBtn';

    setOverlay(
      '<p class="td-overlay-round">Round ' + result.roundNum + ' of ' + state.totalRounds + '</p>' +
      '<h2 class="td-overlay-headline">' + esc(headline) + '</h2>' +
      '<div class="td-overlay-scores">' + scoresHtml + '</div>' +
      '<button class="gg-play-again-btn td-next-btn" id="' + btnId + '">' + btnText + '</button>'
    );

    document.getElementById(btnId).onclick = function () {
      if (result.gameOver) {
        showGameOver();
      } else {
        hideOverlay();
        startCountdown();
      }
    };
  }

  function showGameOver() {
    try { localStorage.removeItem('td_resume'); } catch (_) {}
    var gr = TDEngine.determineGameWinner(state);
    var winnerIdxs = gr.winnerIdxs;

    var headline = winnerIdxs.length === 1
      ? state.players[winnerIdxs[0]].name + ' Wins!'
      : "It's a Tie!";

    var scoresHtml = gr.ranked.map(function (r) {
      var p = state.players[r.playerIdx];
      var isWinner = winnerIdxs.indexOf(r.playerIdx) >= 0;
      return '<div class="td-result-row' + (isWinner ? ' td-result-row--winner' : '') + '">' +
        '<span class="td-result-dot" style="background:' + p.color + '"></span>' +
        '<span class="td-result-name">' + esc(p.name) + '</span>' +
        '<span class="td-result-time">' + r.wins + ' win' + (r.wins !== 1 ? 's' : '') + '</span>' +
        '</div>';
    }).join('');

    setOverlay(
      '<div class="gg-winner-card__trophy">🏆</div>' +
      '<h2 class="td-overlay-headline">' + esc(headline) + '</h2>' +
      '<div class="td-overlay-scores">' + scoresHtml + '</div>' +
      '<div class="gg-winner-card__actions">' +
        '<button class="gg-play-again-btn" id="tdPlayAgainBtn">Play Again</button>' +
        '<button class="gg-home-btn" id="tdHomeBtn">Home</button>' +
      '</div>'
    );

    document.getElementById('tdPlayAgainBtn').onclick = function () {
      try { localStorage.removeItem('td_resume'); } catch (_) {}
      hideOverlay();
      state = TDEngine.initState(config);
      buildArena();
      startCountdown();
    };

    document.getElementById('tdHomeBtn').onclick = function () {
      location.href = '../index.html';
    };
  }

  function setOverlay(html) {
    document.getElementById('tdOverlayContent').innerHTML = html;
    document.getElementById('tdOverlay').hidden = false;
  }

  function hideOverlay() {
    document.getElementById('tdOverlay').hidden = true;
  }

  // ─── UI helpers ───────────────────────────────────────

  function setBtn(pi, btnState, player) {
    var btn = document.getElementById('td-btn-' + pi);
    if (!btn) return;
    btn.className = 'td-tap-btn td-tap-btn--' + btnState;
    if (btnState === 'signal') {
      btn.style.backgroundColor = '#FF3B30';
    } else {
      var alphas = {idle: 0.35, ready: 1, done: 0.4, 'false-start': 0.2};
      var a = alphas[btnState] !== undefined ? alphas[btnState] : 0.45;
      btn.style.backgroundColor = a === 1 ? player.color : hexToRgba(player.color, a);
    }
  }

  function setStatus(pi, text, type) {
    var el = document.getElementById('td-status-' + pi);
    if (!el) return;
    el.textContent = text;
    el.className = 'td-status td-status--' + type;
  }

  function updateDots(pi) {
    var el = document.getElementById('td-dots-' + pi);
    if (!el) return;
    var wins = state.scores[pi];
    var html = '';
    for (var i = 0; i < state.totalRounds; i++) {
      html += '<span class="td-win-dot' + (i < wins ? ' td-win-dot--won' : '') + '"></span>';
    }
    el.innerHTML = html;
  }

  function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── Quit ─────────────────────────────────────────────

  document.getElementById('quitBtn').addEventListener('click', function () {
    clearTimeout(countdownTimer);
    clearTimeout(waitTimer);
    clearTimeout(collectTimer);
    clearInterval(stopwatchInterval);

    var roundsPlayed = state.roundResults.length;
    var gameFinished = (phase === 'gameover') || (roundsPlayed >= state.totalRounds);

    if (!gameFinished && roundsPlayed > 0) {
      try {
        localStorage.setItem('td_resume', JSON.stringify({
          game: 'tap-duel',
          config: config,
          state: TDEngine.serialize(state),
          players: state.players,
          timestamp: Date.now()
        }));
      } catch (_) {}
    } else {
      try { localStorage.removeItem('td_resume'); } catch (_) {}
    }

    location.href = '../index.html';
  });

  // ─── Start ────────────────────────────────────────────

  buildArena();
  setTimeout(startCountdown, 400);

})();
