// WordZ game screen.
// Everyone polls the room and renders from room.state. The HOST additionally runs
// WZEngine as the authority: it reads the ordered submissions, resolves each round
// (first valid word wins), advances, and pushes the new state to the server.

(function () {

  const RACE_MS    = 30000;  // seconds to race for a word
  const HOST_POLL  = 800;
  const GUEST_POLL = 1000;
  const ALPHABET   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const net = WZNet.get();
  if (!net || !net.code) { location.href = 'setup.html'; return; }
  const code = net.code, token = net.token, mySeat = net.seat, isHost = !!net.host;

  let state = null;           // full game+phase state (authoritative for host)
  let lastVersion = -1;
  let pollTimer = null, deadlineTimer = null, tickTimer = null;

  let myPick = null;          // 1v1: the letter I picked this round
  let mySubmittedWord = null; // the word I submitted this round
  let lastRoundKey = '';      // resets per-round local input when it changes
  let arenaKey = '', overlayKey = '';

  // Kick off the dictionary load in the background; play works before it lands.
  WORDZ.ready.catch(function () {});

  // ─── Boot ──────────────────────────────────────────────
  async function boot() {
    try {
      const data = await WZNet.pollRoom(code);
      const room = data.room;
      if (!room) throw new Error('no_room');
      lastVersion = room.version;

      if (isHost && !room.state) {
        // Host opens the game: make sure the dictionary is ready (needed to derive
        // solvable random letters and to validate), then start round 1.
        await WORDZ.ready.catch(function () {});
        state = augment(WZEngine.initState({
          players: room.seats.map(p => ({ name: p.name, color: p.color })),
          variant: room.config.variant,
          rounds:  room.config.rounds,
        }));
        hostStartRound();
      } else {
        state = room.state;
        renderAll();
      }
    } catch (e) {
      console.error('WordZ boot failed:', e);
      location.href = '../index.html';
      return;
    }
    startTick();
    startPolling();
  }

  function augment(s) {
    s.phase = 'picking';
    s.startLetter = null; s.endLetter = null;
    s.pickStartSeat = null; s.pickEndSeat = null;
    s.pickedStart = null; s.pickedEnd = null;
    s.deadline = null; s.roundWinner = null; s.winningWord = null;
    s._gameOver = false;
    return s;
  }

  // ─── Polling ───────────────────────────────────────────
  function startPolling() {
    stopPolling();
    const interval = isHost ? HOST_POLL : GUEST_POLL;
    const tick = async () => {
      try {
        const data = await WZNet.pollRoom(code, lastVersion >= 0 ? lastVersion : undefined);
        if (data && data.changed !== false && data.room) {
          lastVersion = data.room.version;
          onRoom(data.room);
        }
      } catch (e) {
        if (e.status === 404) {
          stopPolling();
          alert('This room has closed.');
          WZNet.clear();
          location.href = '../index.html';
          return;
        }
      }
      pollTimer = setTimeout(tick, interval);
    };
    tick();
  }
  function stopPolling() { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }

  function onRoom(room) {
    if (isHost) {
      hostProcess(room);     // host keeps its own authoritative `state`
    } else {
      state = room.state;    // guests follow the host's state
      renderAll();
    }
  }

  // ─── Host authority ────────────────────────────────────
  function validLetter(v) { return /^[A-Za-z]$/.test(String(v || '')); }

  function hostProcess(room) {
    if (!state) return;
    const subs = room.submissions || [];

    if (state.phase === 'picking') {
      if (state.pickedStart == null) {
        const p = subs.find(s => s.kind === 'pick' && s.seat === state.pickStartSeat && validLetter(s.value));
        if (p) state.pickedStart = String(p.value).toUpperCase();
      }
      if (state.pickedEnd == null) {
        const p = subs.find(s => s.kind === 'pick' && s.seat === state.pickEndSeat && validLetter(s.value));
        if (p) state.pickedEnd = String(p.value).toUpperCase();
      }
      if (state.pickedStart && state.pickedEnd) {
        beginRacing(state.pickedStart, state.pickedEnd);
      }
    } else if (state.phase === 'racing') {
      const words = subs.filter(s => s.kind === 'word');
      for (let i = 0; i < words.length; i++) {
        const s = words[i];
        if (WZEngine.validate(s.value, state.startLetter, state.endLetter, WORDZ.dict)) {
          hostResolveRound(s.seat, String(s.value).trim().toLowerCase());
          return;
        }
      }
    }
  }

  function hostStartRound(extra) {
    myPick = null; mySubmittedWord = null;
    if (state.variant === '1v1') {
      const ps = WZEngine.pickerSeats(state);
      state.phase = 'picking';
      state.pickStartSeat = ps.startSeat;
      state.pickEndSeat   = ps.endSeat;
      state.pickedStart = null; state.pickedEnd = null;
      state.startLetter = null; state.endLetter = null; state.deadline = null;
      state.roundWinner = null; state.winningWord = null;
      pushState(Object.assign({ clearSubmissions: true }, extra || {}));
    } else {
      const L = WZEngine.randomLetters(WORDZ.words);
      beginRacing(L.startLetter, L.endLetter, extra);
    }
  }

  function beginRacing(sL, eL, extra) {
    state.phase = 'racing';
    state.startLetter = sL; state.endLetter = eL;
    state.deadline = Date.now() + RACE_MS;
    state.roundWinner = null; state.winningWord = null;
    pushState(Object.assign({ clearSubmissions: true }, extra || {}));
    scheduleDeadline();
  }

  function scheduleDeadline() {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    const ms = Math.max(0, state.deadline - Date.now());
    deadlineTimer = setTimeout(() => {
      if (state && state.phase === 'racing') hostResolveRound(-1, null);
    }, ms + 60);
  }

  function hostResolveRound(winnerSeat, word) {
    if (deadlineTimer) { clearTimeout(deadlineTimer); deadlineTimer = null; }
    const res = WZEngine.recordRound(state, {
      startLetter: state.startLetter,
      endLetter:   state.endLetter,
      winnerSeat:  winnerSeat,
      word:        word || null,
    });
    state.phase = 'roundresult';
    state.roundWinner = winnerSeat;
    state.winningWord = word || null;
    state._gameOver = res.gameOver;
    pushState({ clearSubmissions: true });
  }

  function hostNextRound() { if (state._gameOver) hostEndGame(); else hostStartRound(); }
  function hostEndGame()   { state.phase = 'gameover'; pushState({ status: 'over', clearSubmissions: true }); }
  function hostPlayAgain() {
    state = augment(WZEngine.initState({
      players: state.players, variant: state.variant, rounds: state.totalRounds,
    }));
    hostStartRound({ status: 'playing' });
  }

  async function pushState(opts) {
    renderAll(); // optimistic local render for the host
    try {
      await WZNet.writeState(code, token, Object.assign({ state: state }, opts || {}));
    } catch (e) {
      console.warn('writeState failed:', e);
    }
  }

  // ─── Player actions ────────────────────────────────────
  function submitPick(letter) {
    myPick = letter;
    renderAll();
    WZNet.submit(code, token, 'pick', letter).catch(e => console.warn('pick failed', e));
  }

  function submitWord(word) {
    mySubmittedWord = word.trim().toLowerCase();
    renderAll();
    WZNet.submit(code, token, 'word', mySubmittedWord).catch(e => console.warn('word failed', e));
  }

  // ─── Rendering ─────────────────────────────────────────
  function renderAll() {
    const key = state ? (state.currentRound + '-' + state.phase) : 'none';
    if (key !== lastRoundKey) { myPick = null; mySubmittedWord = null; lastRoundKey = key; }
    renderScoreBar();
    renderArena();
    renderOverlay();
  }

  function renderScoreBar() {
    const bar = document.getElementById('scoreBar');
    if (!state || !state.players) { bar.innerHTML = ''; return; }
    bar.innerHTML = state.players.map((p, i) => {
      const active = i === mySeat;
      return '<div class="gg-score-chip' + (active ? ' gg-score-chip--active' : '') + '">' +
        '<span class="gg-score-chip__dot" style="background:' + p.color + '"></span>' +
        '<span class="gg-score-chip__name">' + esc(p.name) + (active ? ' (you)' : '') + '</span>' +
        '<span class="gg-score-chip__score">' + (state.scores[i] || 0) + '</span>' +
      '</div>';
    }).join('');
  }

  function computeArenaKey() {
    if (!state) return 'waiting';
    if (state.phase === 'picking') return 'pick-' + state.currentRound + '-' + (myPick ? 'me' : 'choose');
    if (state.phase === 'racing')  return 'race-' + state.currentRound + '-' + (mySubmittedWord ? 'sent' : 'live');
    return 'idle'; // result/gameover handled by overlay
  }

  function renderArena() {
    const k = computeArenaKey();
    if (k === arenaKey) return; // structural state unchanged — the tick handles the timer
    arenaKey = k;

    const arena = document.getElementById('wzArena');
    if (!state) { arena.innerHTML = '<p class="wz-waiting">Getting ready…</p>'; return; }
    if (state.phase === 'picking') return renderPicking(arena);
    if (state.phase === 'racing')  return renderRacing(arena);
    arena.innerHTML = ''; // result / gameover → overlay covers the screen
  }

  function renderPicking(arena) {
    const amStart = mySeat === state.pickStartSeat;
    const amEnd   = mySeat === state.pickEndSeat;
    const role = amStart ? 'first' : 'last';

    if (myPick) {
      arena.innerHTML =
        '<div class="wz-pick">' +
          '<p class="wz-pick__label">You chose</p>' +
          '<div class="wz-tile wz-tile--lit">' + esc(myPick) + '</div>' +
          '<p class="wz-waiting">Waiting for the other player…</p>' +
        '</div>';
      return;
    }

    arena.innerHTML =
      '<div class="wz-pick">' +
        '<p class="wz-pick__label">Pick the <strong>' + role + '</strong> letter</p>' +
        '<p class="wz-pick__sub">' +
          (amStart ? 'Words must <strong>start</strong> with it' : 'Words must <strong>end</strong> with it') +
        '</p>' +
        '<div class="wz-letter-grid">' +
          ALPHABET.map(L => '<button class="wz-letter-btn" data-letter="' + L + '">' + L + '</button>').join('') +
        '</div>' +
      '</div>';

    arena.querySelectorAll('.wz-letter-btn').forEach(btn => {
      btn.addEventListener('click', () => submitPick(btn.dataset.letter));
    });
  }

  function renderRacing(arena) {
    arena.innerHTML =
      '<div class="wz-race">' +
        '<div class="wz-letters">' +
          '<div class="wz-tile">' + esc(state.startLetter) + '</div>' +
          '<span class="wz-letters__dots">·····</span>' +
          '<div class="wz-tile">' + esc(state.endLetter) + '</div>' +
        '</div>' +
        '<div class="wz-timer" id="wzTimer">' + (RACE_MS / 1000).toFixed(1) + 's</div>' +
        (mySubmittedWord
          ? '<div class="wz-sent">Submitted: <strong>' + esc(mySubmittedWord) + '</strong><br><span class="wz-waiting">Waiting for the round to end…</span></div>'
          : '<div class="wz-input-wrap">' +
              '<input class="gg-text-input wz-word-input" id="wzWordInput" type="text" ' +
                'autocomplete="off" autocapitalize="none" spellcheck="false" ' +
                'placeholder="' + esc(state.startLetter) + '…' + esc(state.endLetter) + '" aria-label="Your word">' +
              '<button class="gg-play-btn wz-submit-btn" id="wzSubmitBtn">Submit</button>' +
              '<p class="wz-feedback" id="wzFeedback"></p>' +
            '</div>') +
      '</div>';

    if (mySubmittedWord) return;

    const input = document.getElementById('wzWordInput');
    const fb = document.getElementById('wzFeedback');

    const trySubmit = () => {
      const word = (input.value || '').trim().toLowerCase();
      if (!word) return;
      const sL = state.startLetter.toLowerCase();
      const eL = state.endLetter.toLowerCase();
      if (!/^[a-z]{2,}$/.test(word)) { fb.textContent = 'Letters only (at least 2).'; return; }
      if (word[0] !== sL || word[word.length - 1] !== eL) {
        fb.textContent = 'Must start with ' + state.startLetter + ' and end with ' + state.endLetter + '.';
        return;
      }
      if (WORDZ.dict.size > 0 && !WORDZ.dict.has(word)) { fb.textContent = 'Not in the dictionary.'; return; }
      submitWord(word);
    };

    document.getElementById('wzSubmitBtn').addEventListener('click', trySubmit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') trySubmit(); });
    input.addEventListener('input', () => { fb.textContent = ''; });
    setTimeout(() => { try { input.focus(); } catch (_) {} }, 50);
  }

  // ─── Timer tick ────────────────────────────────────────
  function startTick() { if (tickTimer) clearInterval(tickTimer); tickTimer = setInterval(updateTimer, 150); }
  function updateTimer() {
    if (!state || state.phase !== 'racing' || !state.deadline) return;
    const el = document.getElementById('wzTimer');
    if (!el) return;
    const remain = Math.max(0, state.deadline - Date.now());
    el.textContent = (remain / 1000).toFixed(1) + 's';
    if (remain <= 3000) el.classList.add('wz-timer--low');
  }

  // ─── Overlay (round result + game over) ────────────────
  function renderOverlay() {
    const overlay = document.getElementById('wzOverlay');
    if (!state || (state.phase !== 'roundresult' && state.phase !== 'gameover')) {
      overlay.hidden = true; overlayKey = '';
      return;
    }
    const k = state.phase + '-' + state.currentRound + '-' + state.roundResults.length;
    if (k === overlayKey) return; // already shown
    overlayKey = k;

    if (state.phase === 'roundresult') renderRoundResult();
    else renderGameOver();
    overlay.hidden = false;
  }

  function renderRoundResult() {
    const last = state.roundResults[state.roundResults.length - 1] || {};
    const winner = state.roundWinner;
    const totalTxt = state.totalRounds > 0 ? (' of ' + state.totalRounds) : '';

    let headline, sub;
    if (winner >= 0) {
      headline = esc(state.players[winner].name) + ' got it!';
      sub = '<span class="wz-result-word">' + esc(state.winningWord || '') + '</span>';
    } else {
      headline = 'Nobody got it!';
      sub = '<span class="wz-result-word wz-result-word--miss">' +
            esc(last.startLetter || '') + ' … ' + esc(last.endLetter || '') + '</span>';
    }

    const scores = scoreRowsHtml(state.scores.map((s, i) => ({ idx: i, val: s })), winner);

    let actions;
    if (isHost) {
      if (state._gameOver) {
        actions = '<button class="gg-play-again-btn" id="wzNextBtn">See Final Results</button>';
      } else {
        actions = '<button class="gg-play-again-btn" id="wzNextBtn">Next Round →</button>' +
          (state.totalRounds === 0
            ? '<button class="gg-home-btn" id="wzEndBtn" style="margin-top:8px;width:100%;">End Game</button>'
            : '');
      }
    } else {
      actions = '<p class="wz-waiting">Waiting for the host…</p>';
    }

    setOverlay(
      '<p class="td-overlay-round">Round ' + (last.round || state.currentRound) + totalTxt + '</p>' +
      '<h2 class="td-overlay-headline">' + headline + '</h2>' +
      '<p class="wz-result-sub">' + sub + '</p>' +
      '<div class="td-overlay-scores">' + scores + '</div>' +
      actions
    );

    if (isHost) {
      const nb = document.getElementById('wzNextBtn');
      if (nb) nb.onclick = hostNextRound;
      const eb = document.getElementById('wzEndBtn');
      if (eb) eb.onclick = hostEndGame;
    }
  }

  function renderGameOver() {
    const gw = WZEngine.determineGameWinner(state);
    const headline = gw.winnerIdxs.length === 1
      ? esc(state.players[gw.winnerIdxs[0]].name) + ' Wins!'
      : "It's a Tie!";

    const ranked = gw.ranked.map(r => ({ idx: r.playerIdx, val: r.wins }));
    const scores = scoreRowsHtml(ranked, null, gw.winnerIdxs);

    let actions;
    if (isHost) {
      actions =
        '<div class="gg-winner-card__actions">' +
          '<button class="gg-play-again-btn" id="wzAgainBtn">Play Again</button>' +
          '<button class="gg-home-btn" id="wzHomeBtn">Home</button>' +
        '</div>';
    } else {
      actions =
        '<p class="wz-waiting">The host can start a new game.</p>' +
        '<button class="gg-home-btn" id="wzHomeBtn" style="width:100%;margin-top:6px;">Home</button>';
    }

    setOverlay(
      '<div class="gg-winner-card__trophy">🏆</div>' +
      '<h2 class="td-overlay-headline">' + headline + '</h2>' +
      '<div class="td-overlay-scores">' + scores + '</div>' +
      actions
    );

    const again = document.getElementById('wzAgainBtn');
    if (again) again.onclick = hostPlayAgain;
    const home = document.getElementById('wzHomeBtn');
    if (home) home.onclick = goHome;
  }

  // rows: [{idx,val}], `winnerSeat` highlights one row, `winnerIdxs` highlights several
  function scoreRowsHtml(rows, winnerSeat, winnerIdxs) {
    return rows.map(r => {
      const p = state.players[r.idx];
      const isWinner = (winnerSeat != null && r.idx === winnerSeat) ||
                       (winnerIdxs && winnerIdxs.indexOf(r.idx) >= 0);
      return '<div class="td-result-row' + (isWinner ? ' td-result-row--winner' : '') + '">' +
        '<span class="td-result-dot" style="background:' + p.color + '"></span>' +
        '<span class="td-result-name">' + esc(p.name) + (r.idx === mySeat ? ' (you)' : '') + '</span>' +
        '<span class="td-result-time">' + r.val + ' pt' + (r.val === 1 ? '' : 's') + '</span>' +
      '</div>';
    }).join('');
  }

  function setOverlay(html) {
    document.getElementById('wzOverlayContent').innerHTML = html;
  }

  // ─── Quit / leave ──────────────────────────────────────
  function goHome() { WZNet.clear(); location.href = '../index.html'; }

  document.getElementById('quitBtn').addEventListener('click', async () => {
    stopPolling();
    if (deadlineTimer) clearTimeout(deadlineTimer);
    if (tickTimer) clearInterval(tickTimer);
    // A leaving host ends the game so guests aren't left waiting forever.
    if (isHost && state && state.phase !== 'gameover') {
      state.phase = 'gameover';
      try { await WZNet.writeState(code, token, { state: state, status: 'over', clearSubmissions: true }); } catch (_) {}
    }
    goHome();
  });

  // ─── Helpers ───────────────────────────────────────────
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  boot();

})();
