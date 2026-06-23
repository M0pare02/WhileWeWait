(function () {

  var PALETTE = ['#FF6B6B', '#45B7D1', '#FFC947', '#A855F7', '#FF6B9D', '#98D856'];

  var players = [
    { name: '', color: PALETTE[0] },
    { name: '', color: PALETTE[1] }
  ];
  var selectedRounds = 5;
  var popoverOpenFor = null; // playerIdx that has the colour popover open

  // ─── Rounds picker ─────────────────────────────────────
  document.querySelectorAll('.td-round-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedRounds = parseInt(btn.dataset.rounds, 10);
      document.querySelectorAll('.td-round-btn').forEach(function (b) {
        b.classList.toggle('td-round-btn--active', b === btn);
      });
    });
  });

  // ─── Player list ────────────────────────────────────────
  var playerList = document.getElementById('playerList');
  var addPlayerBtn = document.getElementById('addPlayerBtn');

  function usedColors() {
    return players.map(function (p) { return p.color; });
  }

  function renderPlayers() {
    playerList.innerHTML = '';
    players.forEach(function (p, i) {
      var row = document.createElement('div');
      row.className = 'gg-player-row';

      var swatch = document.createElement('button');
      swatch.className = 'gg-color-swatch';
      swatch.style.background = p.color;
      swatch.setAttribute('aria-label', 'Pick colour for player ' + (i + 1));
      swatch.addEventListener('click', function (e) {
        e.stopPropagation();
        openPopover(i, swatch);
      });

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'gg-player-name';
      input.placeholder = 'Player ' + (i + 1);
      input.value = p.name;
      input.maxLength = 16;
      input.addEventListener('input', function () { players[i].name = input.value; });

      row.appendChild(swatch);
      row.appendChild(input);

      if (players.length > 2) {
        var removeBtn = document.createElement('button');
        removeBtn.className = 'gg-remove-player';
        removeBtn.setAttribute('aria-label', 'Remove player ' + (i + 1));
        removeBtn.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none">' +
            '<path d="M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
          '</svg>';
        removeBtn.addEventListener('click', function () {
          players.splice(i, 1);
          renderPlayers();
          updateAddBtn();
        });
        row.appendChild(removeBtn);
      }

      playerList.appendChild(row);
    });
  }

  function updateAddBtn() {
    addPlayerBtn.hidden = players.length >= 4;
  }

  addPlayerBtn.addEventListener('click', function () {
    if (players.length >= 4) return;
    var used = usedColors();
    var nextColor = PALETTE.find(function (c) { return !used.includes(c); }) || PALETTE[players.length % PALETTE.length];
    players.push({ name: '', color: nextColor });
    renderPlayers();
    updateAddBtn();
  });

  // ─── Colour popover ─────────────────────────────────────
  var popover = document.getElementById('colorPopover');
  var swatchGrid = document.getElementById('swatchGrid');

  function openPopover(playerIdx, anchorEl) {
    if (popoverOpenFor === playerIdx) { closePopover(); return; }
    popoverOpenFor = playerIdx;

    swatchGrid.innerHTML = '';
    PALETTE.forEach(function (color) {
      var btn = document.createElement('button');
      btn.className = 'gg-popover-swatch';
      btn.style.background = color;
      if (color === players[playerIdx].color) btn.classList.add('gg-popover-swatch--active');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        players[playerIdx].color = color;
        closePopover();
        renderPlayers();
      });
      swatchGrid.appendChild(btn);
    });

    popover.hidden = false;
  }

  function closePopover() {
    popover.hidden = true;
    popoverOpenFor = null;
  }

  document.addEventListener('click', function () { closePopover(); });
  popover.addEventListener('click', function (e) { e.stopPropagation(); });

  // ─── Play button ────────────────────────────────────────
  document.getElementById('playBtn').addEventListener('click', function () {
    var configured = players.map(function (p, i) {
      return { name: p.name.trim() || ('Player ' + (i + 1)), color: p.color };
    });
    var config = { players: configured, rounds: selectedRounds };
    try { sessionStorage.setItem('td_config', JSON.stringify(config)); } catch (_) {}
    location.href = 'game.html';
  });

  // ─── Init ────────────────────────────────────────────────
  renderPlayers();
  updateAddBtn();

})();
