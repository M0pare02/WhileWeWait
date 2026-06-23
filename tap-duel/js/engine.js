// Tap Duel — pure game logic

const TDEngine = (() => {

  function initState(config) {
    return {
      players:      config.players.map(p => ({ name: p.name, color: p.color })),
      totalRounds:  config.rounds,
      currentRound: 1,
      scores:       new Array(config.players.length).fill(0),
      roundResults: []
    };
  }

  // tapTimes: array indexed by playerIdx
  //   number  → valid reaction time in ms
  //   null    → did not tap (timeout) or false start — cannot win
  function resolveRound(state, tapTimes) {
    const validTimes = tapTimes.map(t => (typeof t === 'number' && t >= 0) ? t : null);

    const minTime = validTimes.reduce((min, t) => {
      if (t === null) return min;
      return min === null ? t : Math.min(min, t);
    }, null);

    const winnerIdxs = minTime === null
      ? []
      : validTimes.map((t, i) => t === minTime ? i : -1).filter(i => i >= 0);

    winnerIdxs.forEach(i => state.scores[i]++);

    const roundNum = state.currentRound;
    state.roundResults.push({ round: roundNum, winnerIdxs, times: tapTimes });

    const gameOver = state.currentRound >= state.totalRounds;
    if (!gameOver) state.currentRound++;

    return { winnerIdxs, times: tapTimes, roundNum, gameOver };
  }

  function determineGameWinner(state) {
    const maxScore = Math.max(...state.scores);
    const winnerIdxs = state.scores
      .map((s, i) => s === maxScore ? i : -1)
      .filter(i => i >= 0);
    const ranked = state.scores
      .map((s, i) => ({ playerIdx: i, wins: s }))
      .sort((a, b) => b.wins - a.wins);
    return { winnerIdxs, ranked };
  }

  function serialize(state) {
    return {
      players:      state.players,
      totalRounds:  state.totalRounds,
      currentRound: state.currentRound,
      scores:       state.scores,
      roundResults: state.roundResults
    };
  }

  function deserialize(snap) {
    return {
      players:      snap.players,
      totalRounds:  snap.totalRounds,
      currentRound: snap.currentRound,
      scores:       snap.scores,
      roundResults: snap.roundResults
    };
  }

  return { initState, resolveRound, determineGameWinner, serialize, deserialize };
})();
