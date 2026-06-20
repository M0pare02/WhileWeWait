// Grid Grab game engine — pure logic, no DOM

const GGEngine = (() => {

function initState(config) {
    const { cols, rows, players } = config;
    const hCount = rows * (cols - 1);       // horizontal line segments
    const vCount = (rows - 1) * cols;       // vertical line segments
    const boxCount = (rows - 1) * (cols - 1);

    return {
      cols,
      rows,
      players,
      hLines: new Uint8Array(hCount),       // 0=undrawn, playerIndex+1
      vLines: new Uint8Array(vCount),
      boxes:  new Int8Array(boxCount).fill(-1),
      scores: new Array(players.length).fill(0),
      currentPlayer: 0,
      totalPlayers: players.length,
      filledBoxes: 0,
      totalBoxes: boxCount,
    };
  }

  // Index helpers
  function hIdx(state, row, col) { return row * (state.cols - 1) + col; }
  function vIdx(state, row, col) { return row * state.cols + col; }
  function bIdx(state, row, col) { return row * (state.cols - 1) + col; }

  function isHDrawn(state, row, col) { return state.hLines[hIdx(state, row, col)] > 0; }
  function isVDrawn(state, row, col) { return state.vLines[vIdx(state, row, col)] > 0; }

  // Check if box (row, col) — 0-indexed in box space — is complete
  function isBoxComplete(state, bRow, bCol) {
    // top, bottom horizontal; left, right vertical
    return isHDrawn(state, bRow,     bCol)   // top
        && isHDrawn(state, bRow + 1, bCol)   // bottom
        && isVDrawn(state, bRow,     bCol)   // left
        && isVDrawn(state, bRow,     bCol + 1); // right
  }

  // Returns array of {row, col} for boxes newly completed by this line
  function checkAdjacentBoxes(state, kind, row, col, playerIdx) {
    const completed = [];
    const candidates = [];

    if (kind === 'h') {
      // Horizontal line at dot-row `row`, segment col→col+1
      // Box above: bRow = row-1, bCol = col
      if (row > 0) candidates.push({ bRow: row - 1, bCol: col });
      // Box below: bRow = row, bCol = col
      if (row < state.rows - 1) candidates.push({ bRow: row, bCol: col });
    } else {
      // Vertical line at dot-col `col`, segment row→row+1
      // Box left: bRow = row, bCol = col-1
      if (col > 0) candidates.push({ bRow: row, bCol: col - 1 });
      // Box right: bRow = row, bCol = col
      if (col < state.cols - 1) candidates.push({ bRow: row, bCol: col });
    }

    for (const { bRow, bCol } of candidates) {
      const idx = bIdx(state, bRow, bCol);
      if (state.boxes[idx] === -1 && isBoxComplete(state, bRow, bCol)) {
        state.boxes[idx] = playerIdx;
        state.scores[playerIdx]++;
        state.filledBoxes++;
        completed.push({ row: bRow, col: bCol });
      }
    }

    return completed;
  }

  // Main move function. Returns null if line already drawn.
  // Returns { completedBoxes, nextPlayer, gameOver }
  function tryClaimLine(state, kind, row, col) {
    const arr = kind === 'h' ? state.hLines : state.vLines;
    const idx = kind === 'h' ? hIdx(state, row, col) : vIdx(state, row, col);

    if (arr[idx] > 0) return null; // already drawn

    arr[idx] = state.currentPlayer + 1;

    const completedBoxes = checkAdjacentBoxes(state, kind, row, col, state.currentPlayer);

    const gameOver = state.filledBoxes >= state.totalBoxes;

    // Same player goes again if they completed a box; otherwise advance
    if (completedBoxes.length === 0) {
      state.currentPlayer = (state.currentPlayer + 1) % state.totalPlayers;
    }

    return {
      completedBoxes,
      nextPlayer: state.currentPlayer,
      gameOver,
    };
  }

  function determineWinner(state) {
    const maxScore = Math.max(...state.scores);
    const winners = state.scores
      .map((s, i) => ({ score: s, idx: i }))
      .filter(p => p.score === maxScore)
      .map(p => p.idx);

    const ranked = state.scores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score);

    return { winners, maxScore, ranked };
  }

  return { initState, tryClaimLine, determineWinner };
})();
