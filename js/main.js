// =============================
// INIT
// =============================
document.addEventListener('DOMContentLoaded', () => {
  initColorPickers();
  showScreen('home');
});

// Close any open color picker when tapping outside a player entry
document.addEventListener('click', (e) => {
  if (!e.target.closest('.player-entry')) closeAllColorPickers();
});
