// =============================
// THEME
// =============================
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update pill buttons in profile screen
  document.querySelectorAll('.theme-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  // Update hero button icon
  const heroBtn = document.getElementById('hero-theme-btn');
  if (heroBtn) heroBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function setTheme(theme) {
  localStorage.setItem('wwwTheme', theme);
  applyTheme(theme);
}

function initTheme() {
  const saved = localStorage.getItem('wwwTheme');
  applyTheme(saved || getSystemTheme());

  // Follow system preference if user hasn't pinned a choice
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('wwwTheme')) applyTheme(e.matches ? 'dark' : 'light');
  });
}

// =============================
// INIT
// =============================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initColorPickers();
  showScreen('home');
});

// Close any open color picker when tapping outside a player entry
document.addEventListener('click', (e) => {
  if (!e.target.closest('.player-entry')) closeAllColorPickers();
});
