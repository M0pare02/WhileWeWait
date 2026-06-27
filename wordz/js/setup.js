// WordZ setup screen — host configures the room, then creates it.

(function () {

  const PALETTE = ['#FF6B6B', '#45B7D1', '#FFC947', '#4ECDC4', '#FF6B9D', '#98D856'];

  let variant = '1v1';            // '1v1' | 'multi'
  let rounds  = 5;                // 0 = endless
  let host    = { name: '', color: PALETTE[0] };
  let popoverOpen = false;

  // ─── Host row ──────────────────────────────────────────
  const hostRow = document.getElementById('hostRow');

  function renderHost() {
    hostRow.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'gg-player-row';

    const swatch = document.createElement('button');
    swatch.className = 'gg-color-swatch';
    swatch.style.background = host.color;
    swatch.setAttribute('aria-label', 'Pick your color');
    swatch.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePopover();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gg-player-name';
    input.placeholder = 'Your name';
    input.value = host.name;
    input.maxLength = 16;
    input.addEventListener('input', function () { host.name = input.value; });

    row.appendChild(swatch);
    row.appendChild(input);
    hostRow.appendChild(row);
  }

  // ─── Variant toggle ────────────────────────────────────
  document.querySelectorAll('.gg-mode-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.gg-mode-option').forEach(function (b) {
        b.classList.remove('gg-mode-option--active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('gg-mode-option--active');
      btn.setAttribute('aria-checked', 'true');
      variant = btn.dataset.variant;
      const hint = document.getElementById('joinersHint');
      hint.textContent = variant === '1v1'
        ? 'One friend joins from their phone in the next screen.'
        : 'Friends join from their own phones in the next screen (up to 8).';
    });
  });

  // ─── Rounds picker ─────────────────────────────────────
  document.querySelectorAll('.td-round-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      rounds = parseInt(btn.dataset.rounds, 10);
      document.querySelectorAll('.td-round-btn').forEach(function (b) {
        b.classList.toggle('td-round-btn--active', b === btn);
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
    });
  });

  // ─── Colour popover ────────────────────────────────────
  const popover = document.getElementById('colorPopover');

  function togglePopover() {
    if (popoverOpen) { closePopover(); return; }
    popoverOpen = true;
    popover.querySelectorAll('.gg-color-option').forEach(function (btn) {
      btn.classList.toggle('gg-color-option--selected', btn.dataset.color === host.color);
    });
    popover.hidden = false;
  }
  function closePopover() { popover.hidden = true; popoverOpen = false; }

  popover.querySelectorAll('.gg-color-option').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      host.color = btn.dataset.color;
      closePopover();
      renderHost();
    });
  });
  document.addEventListener('click', closePopover);
  popover.addEventListener('click', function (e) { e.stopPropagation(); });

  // ─── Create room ───────────────────────────────────────
  document.getElementById('createBtn').addEventListener('click', async function () {
    const btn = this;
    const hostInfo = { name: host.name.trim() || 'Player 1', color: host.color };
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const data = await WZNet.createRoom({ variant: variant, rounds: rounds }, hostInfo);
      WZNet.set({ code: data.code, token: data.token, seat: 0, host: true });
      location.href = 'lobby.html?room=' + data.code;
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Create Room';
      console.error('createRoom failed:', e);
      alert('Could not create room — ' + (e.message || 'unknown error') + '. Check your connection and try again.');
    }
  });

  // ─── Join an existing room ─────────────────────────────
  document.getElementById('joinBtn').addEventListener('click', function () {
    location.href = 'lobby.html?join';
  });

  // ─── Init ──────────────────────────────────────────────
  renderHost();

})();
