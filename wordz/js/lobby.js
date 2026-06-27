// WordZ lobby — shared by the host and joining players.
// Three views (code entry → join → roster), driven by URL params + wz_net.
// Unlike Grid Grab the seat list grows dynamically; the host can start once at
// least two players are in (1v1 needs exactly its two seats filled).

(function () {

  const PALETTE = ['#FF6B6B', '#45B7D1', '#FFC947', '#4ECDC4', '#FF6B9D', '#98D856'];
  const MIN_PLAYERS = 2;

  let code = '';
  let view = '';
  let selectedColor = PALETTE[0];
  let currentRender = null;       // renderJoin | renderRoster
  let pollTimer = null;
  let lastVersion = -1;
  let leavingForGame = false;     // true when navigating to game.html — suppresses beacon

  // ─── View plumbing ─────────────────────────────────
  function showPanel(id) {
    ['codePanel', 'joinPanel', 'rosterPanel'].forEach(p => {
      document.getElementById(p).hidden = (p !== id);
    });
  }

  function setAction(label, handler, enabled) {
    const btn = document.getElementById('actionBtn');
    if (label == null) { btn.hidden = true; btn.onclick = null; return; }
    btn.hidden = false;
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.onclick = enabled ? handler : null;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.hidden = false;
  }
  function hideError(id) { document.getElementById(id).hidden = true; }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  // ─── Polling ───────────────────────────────────────
  function startPolling() {
    stopPolling();
    lastVersion = -1;
    const tick = async () => {
      try {
        const data = await WZNet.pollRoom(code, lastVersion >= 0 ? lastVersion : undefined);
        if (data && data.changed !== false && data.room) {
          lastVersion = data.room.version;
          if (currentRender) currentRender(data.room);
        }
      } catch (e) {
        if (e.status === 404) {
          stopPolling();
          alert('This room has closed.');
          location.href = '../index.html';
          return;
        }
      }
      pollTimer = setTimeout(tick, 1500);
    };
    tick();
  }

  function stopPolling() {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  // ─── Code-entry view ───────────────────────────────
  function enterCodeEntry() {
    view = 'code';
    currentRender = null;
    showPanel('codePanel');

    const input = document.getElementById('codeInput');
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      hideError('codeError');
    });

    setAction('Continue', () => {
      const c = input.value.trim().toUpperCase();
      if (c.length !== 4) { showError('codeError', 'Enter the 4-character code.'); return; }
      location.href = `lobby.html?room=${c}`;
    }, true);

    input.focus();
  }

  // ─── Join view ─────────────────────────────────────
  function renderColors(taken) {
    const row = document.getElementById('colorRow');
    row.innerHTML = '';
    PALETTE.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'gg-color-option' + (c === selectedColor ? ' gg-color-option--selected' : '');
      btn.style.background = c;
      if (taken && taken.includes(c)) {
        btn.style.opacity = '0.3';
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => { selectedColor = c; renderColors(taken); });
      }
      row.appendChild(btn);
    });
  }

  function enterJoin() {
    view = 'join';
    currentRender = renderJoin;
    showPanel('joinPanel');
    document.getElementById('joinCode').textContent = code;
    renderColors([]);
    setAction('Join', doJoin, true);
    startPolling();
  }

  function renderJoin(room) {
    document.getElementById('joinCode').textContent = room.code;

    const taken = room.seats.map(s => s.color);
    if (taken.includes(selectedColor)) {
      const free = PALETTE.find(c => !taken.includes(c));
      if (free) selectedColor = free;
    }
    renderColors(taken);

    const full    = room.seats.length >= room.maxSeats;
    const started = room.status !== 'lobby';

    if (started) {
      setAction('Game already started', null, false);
      showError('joinError', 'This game has already started.');
    } else if (full) {
      setAction('Room is full', null, false);
      showError('joinError', 'This room is full.');
    } else {
      setAction('Join', doJoin, true);
      hideError('joinError');
    }
  }

  async function doJoin() {
    const name = (document.getElementById('nameInput').value || '').trim() || 'Player';
    setAction('Joining…', null, false);
    try {
      const data = await WZNet.joinRoom(code, name, selectedColor);
      WZNet.set({ code, token: data.token, seat: data.seat, host: false });
      enterRoster();
    } catch (e) {
      const msg = e.data && e.data.error;
      showError('joinError',
        msg === 'full' ? 'This room is full.' :
        msg === 'already_started' ? 'This game has already started.' :
        'Could not join. Check your connection and try again.');
      setAction('Join', doJoin, true);
    }
  }

  // ─── Roster view ───────────────────────────────────
  function enterRoster() {
    view = 'roster';
    currentRender = renderRoster;
    showPanel('rosterPanel');
    document.getElementById('roomCode').textContent = code;
    startPolling();
  }

  function renderRoster(room) {
    document.getElementById('roomCode').textContent = room.code;

    const list = document.getElementById('seatList');
    list.innerHTML = '';
    room.seats.forEach((s, i) => {
      const seat = document.createElement('div');
      seat.className = 'gg-seat';
      seat.innerHTML = `
        <span class="gg-seat__dot" style="background:${s.color}"></span>
        <span class="gg-seat__name">${escapeHtml(s.name)}</span>
        ${i === 0 ? '<span class="gg-seat__badge">Host</span>' : ''}`;
      list.appendChild(seat);
    });

    // For 1v1 show the empty opponent slot so it's clear someone needs to join.
    if (room.config.variant === '1v1' && room.seats.length < room.maxSeats) {
      const seat = document.createElement('div');
      seat.className = 'gg-seat gg-seat--empty';
      seat.innerHTML = `
        <span class="gg-seat__dot"></span>
        <span class="gg-seat__name">Waiting…</span>`;
      list.appendChild(seat);
    }

    if (room.status === 'playing') {
      stopPolling();
      location.href = 'game.html';
      return;
    }

    const net = WZNet.get();
    const isHost = net && net.host;
    const count = room.seats.length;
    const is1v1 = room.config.variant === '1v1';
    const canStart = is1v1 ? count === 2 : count >= MIN_PLAYERS;

    if (isHost) {
      setAction('Start Game', doStart, canStart);
      const hint = document.getElementById('rosterHint');
      if (canStart) {
        hint.textContent = is1v1
          ? 'Both players in — tap Start!'
          : `${count} players in — tap Start, or wait for more (up to ${room.maxSeats}).`;
      } else {
        hint.textContent = is1v1
          ? 'Waiting for your opponent to join…'
          : `Need at least ${MIN_PLAYERS} players — ${MIN_PLAYERS - count} more to go…`;
      }
    } else {
      setAction(null);
      document.getElementById('rosterHint').textContent = 'Waiting for the host to start…';
    }
  }

  async function doStart() {
    const net = WZNet.get();
    setAction('Starting…', null, false);
    try {
      await WZNet.startGame(code, net.token);
      stopPolling();
      leavingForGame = true;
      location.href = 'game.html';
    } catch (e) {
      setAction('Start Game', doStart, true);
      document.getElementById('rosterHint').textContent = 'Could not start — try again.';
    }
  }

  // ─── Boot ──────────────────────────────────────────
  document.getElementById('backBtn').addEventListener('click', async () => {
    const net = WZNet.get();
    if (net && net.host) {
      stopPolling();
      try { await WZNet.closeRoom(net.code, net.token); } catch (_) {}
    }
    location.href = '../index.html';
  });

  window.addEventListener('beforeunload', () => {
    if (leavingForGame) return;
    const net = WZNet.get();
    if (net && net.host) WZNet.beaconCloseRoom(net.code, net.token);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPolling();
    else if (view === 'join' || view === 'roster') startPolling();
  });

  (function init() {
    const params    = new URLSearchParams(location.search);
    const roomParam = (params.get('room') || '').toUpperCase();
    const joinParam = params.has('join');
    const net       = WZNet.get();

    code = roomParam || (net && net.code) || '';

    if (!code && joinParam) { enterCodeEntry(); return; }
    if (!code)              { location.href = 'setup.html'; return; }

    if (net && net.code === code) enterRoster();  // already a member (host or player)
    else                          enterJoin();    // have a code, not joined yet
  })();

})();
