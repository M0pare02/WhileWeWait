// WordZ — pure game logic (no DOM, no timers, no network).
// Shared shape used by the host's game screen as the single source of truth.
// The host runs this engine in the browser; the server only relays state.

const WZEngine = (() => {

  // ─── Setup ─────────────────────────────────────────────
  // config: { players:[{name,color}], variant:'1v1'|'multi', rounds:N }
  //   rounds === 0  → endless (host ends manually)
  function initState(config) {
    return {
      players:      config.players.map(p => ({ name: p.name, color: p.color })),
      variant:      config.variant === '1v1' ? '1v1' : 'multi',
      totalRounds:  config.rounds > 0 ? config.rounds : 0, // 0 = endless
      currentRound: 1,
      scores:       new Array(config.players.length).fill(0),
      roundResults: [],
    };
  }

  // ─── 1v1 letter pickers ────────────────────────────────
  // Each round the start/end picking roles alternate between the two seats.
  // Odd rounds: seat 0 picks start, seat 1 picks end. Even rounds: swapped.
  function pickerSeats(state) {
    const flip = (state.currentRound % 2) === 0;
    return flip
      ? { startSeat: 1, endSeat: 0 }
      : { startSeat: 0, endSeat: 1 };
  }

  // ─── Random letters (multiplayer) ──────────────────────
  // Derive the round's letters from a random dictionary word so at least one
  // valid answer is guaranteed. Falls back to random A–Z when no word list.
  function randomLetters(words) {
    if (words && words.length) {
      const w = words[Math.floor(Math.random() * words.length)];
      return {
        startLetter: w[0].toUpperCase(),
        endLetter:   w[w.length - 1].toUpperCase(),
      };
    }
    const rand = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return { startLetter: rand(), endLetter: rand() };
  }

  // ─── Word validation ───────────────────────────────────
  // A submission is valid when it (a) starts with startLetter, (b) ends with
  // endLetter, (c) is at least 2 letters, and (d) is in the dictionary. When no
  // dictionary is available we fall back to the letter checks only (honor system).
  function validate(word, startLetter, endLetter, dict) {
    const w = String(word || '').trim().toLowerCase();
    if (!/^[a-z]{2,}$/.test(w)) return false;
    const start = String(startLetter || '').toLowerCase();
    const end   = String(endLetter || '').toLowerCase();
    if (w[0] !== start) return false;
    if (w[w.length - 1] !== end) return false;
    if (dict && typeof dict.has === 'function' && dict.size > 0) {
      return dict.has(w);
    }
    return true; // no dictionary loaded → letter-only (honor system) fallback
  }

  // ─── Round resolution ──────────────────────────────────
  // result: { startLetter, endLetter, winnerSeat (>=0 or -1), word }
  // Advances the round counter and returns whether the game is over.
  function recordRound(state, result) {
    if (result.winnerSeat >= 0) state.scores[result.winnerSeat]++;

    state.roundResults.push({
      round:       state.currentRound,
      startLetter: result.startLetter,
      endLetter:   result.endLetter,
      winnerSeat:  result.winnerSeat,
      word:        result.word || null,
    });

    const gameOver = state.totalRounds > 0 && state.currentRound >= state.totalRounds;
    if (!gameOver) state.currentRound++;
    return { gameOver };
  }

  // ─── Final standings ───────────────────────────────────
  function determineGameWinner(state) {
    const maxScore = Math.max(...state.scores, 0);
    const winnerIdxs = state.scores
      .map((s, i) => (s === maxScore ? i : -1))
      .filter(i => i >= 0);
    const ranked = state.scores
      .map((s, i) => ({ playerIdx: i, wins: s }))
      .sort((a, b) => b.wins - a.wins);
    return { winnerIdxs, ranked, maxScore };
  }

  // ─── (De)serialization ─────────────────────────────────
  // State is already plain JSON; these exist for parity with the other engines.
  function serialize(state) {
    return {
      players:      state.players,
      variant:      state.variant,
      totalRounds:  state.totalRounds,
      currentRound: state.currentRound,
      scores:       state.scores,
      roundResults: state.roundResults,
    };
  }

  function deserialize(snap) {
    return {
      players:      snap.players,
      variant:      snap.variant,
      totalRounds:  snap.totalRounds,
      currentRound: snap.currentRound,
      scores:       snap.scores.slice(),
      roundResults: snap.roundResults.slice(),
    };
  }

  return {
    initState, pickerSeats, randomLetters, validate,
    recordRound, determineGameWinner, serialize, deserialize,
  };
})();

// Node export (harmless in the browser) so the logic stays testable in isolation.
if (typeof module !== 'undefined' && module.exports) module.exports = WZEngine;
