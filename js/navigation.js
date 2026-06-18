const screens = ['home', 'setup', 'game', 'victory', 'profile'];

function showScreen(id, direction = 'forward') {
  screens.forEach(s => {
    const el = document.getElementById('screen-' + s);
    el.classList.remove('active', 'screen-enter', 'screen-exit-back');
  });
  const target = document.getElementById('screen-' + id);
  target.classList.add('active');
  if (direction === 'forward') target.classList.add('screen-enter');
  else target.classList.add('screen-exit-back');
  setTimeout(() => target.classList.remove('screen-enter', 'screen-exit-back'), 300);
  window.scrollTo(0, 0);
}

function showHome()    { showScreen('home', 'back'); }
function showSetup()   { showScreen('setup'); }
function showProfile() { showScreen('profile'); }

function showVictory(winnerIdx) {
  showScreen('victory');
  const name = players[winnerIdx].name;
  document.getElementById('winner-name').textContent = name;

  const container = document.getElementById('victory-scores');
  const sorted = [...players].sort((a, b) => b.score - a.score);
  container.innerHTML = sorted.map((p, i) => `
    <div class="v-score-row">
      <div class="v-score-left">
        <div class="v-score-dot" style="background:${p.color}"></div>
        <div class="v-score-name">${p.name}${i === 0 ? '<span class="trophy">🏆</span>' : ''}</div>
      </div>
      <div class="v-score-num">${p.score}</div>
    </div>
  `).join('');

  document.getElementById('victory-sub').textContent =
    `Captured ${sorted[0].score} of ${totalSquares} squares`;
  showToast('🏆', `${name} wins!`);
}
