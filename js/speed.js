const speedCategories = [
  "Things you find in a hospital", "Movies from the 90s", "Types of pasta",
  "World capitals", "Animals that can swim", "Things you'd find at a beach",
  "Brands of sneakers", "Video game characters", "Things in a grocery store",
  "Types of cheese", "Careers that start with 'D'", "Olympic sports",
  "Things in a backpack", "Board games", "Countries in Europe",
  "Cartoon characters", "Toppings on a pizza", "Things that are red",
  "Famous scientists", "Dance styles",
];

let speedScore = 0;
let speedRound = 0;
let speedTimerVal = 30;
let speedTimerInterval = null;
let speedRunning = false;

function speedReset() {
  speedScore = 0;
  speedRound = 0;
  speedRunning = false;
  clearInterval(speedTimerInterval);
  document.getElementById('speed-score').textContent = '0';
  document.getElementById('speed-round').textContent = '1';
  document.getElementById('speed-category').textContent = 'Name 5 things in the category shown — then pass the phone!';
  document.getElementById('speed-status').textContent = 'Ready to play!';
  document.getElementById('speed-timer').classList.add('hidden');
  document.getElementById('speed-actions-start').classList.remove('hidden');
  document.getElementById('speed-actions-play').classList.add('hidden');
  document.querySelector('.speed-timer').classList.remove('urgent');
}

function speedStart() {
  speedRound++;
  speedRunning = true;
  speedTimerVal = 30;
  const cat = speedCategories[Math.floor(Math.random() * speedCategories.length)];

  document.getElementById('speed-category').textContent = cat;
  document.getElementById('speed-status').textContent = '🔥 Go go go!';
  document.getElementById('speed-round').textContent = speedRound;
  document.getElementById('speed-timer').textContent = '30';
  document.getElementById('speed-timer').classList.remove('hidden', 'urgent');
  document.getElementById('speed-actions-start').classList.add('hidden');
  document.getElementById('speed-actions-play').classList.remove('hidden');

  clearInterval(speedTimerInterval);
  speedTimerInterval = setInterval(() => {
    speedTimerVal--;
    document.getElementById('speed-timer').textContent = speedTimerVal;
    if (speedTimerVal <= 10) document.getElementById('speed-timer').classList.add('urgent');
    if (speedTimerVal <= 0) {
      clearInterval(speedTimerInterval);
      document.getElementById('speed-status').textContent = "⏰ Time's up!";
      document.getElementById('speed-actions-play').classList.add('hidden');
      document.getElementById('speed-actions-start').classList.remove('hidden');
      speedRunning = false;
    }
  }, 1000);
}

function speedGot() {
  speedScore++;
  document.getElementById('speed-score').textContent = speedScore;
  clearInterval(speedTimerInterval);
  document.getElementById('speed-status').textContent = '✅ Got it!';
  document.getElementById('speed-actions-play').classList.add('hidden');
  document.getElementById('speed-timer').classList.add('hidden');
  setTimeout(() => {
    document.getElementById('speed-actions-start').classList.remove('hidden');
    document.getElementById('speed-status').textContent = 'Pass the phone — next round!';
  }, 800);
}

function speedSkip() {
  clearInterval(speedTimerInterval);
  document.getElementById('speed-status').textContent = 'Skipped!';
  document.getElementById('speed-actions-play').classList.add('hidden');
  document.getElementById('speed-timer').classList.add('hidden');
  setTimeout(() => {
    document.getElementById('speed-actions-start').classList.remove('hidden');
    document.getElementById('speed-status').textContent = 'Try a new category!';
  }, 600);
}
