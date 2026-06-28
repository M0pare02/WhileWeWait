// WordZ dictionary loader.
// Fetches the bundled word list once and exposes:
//   WORDZ.dict   → Set<string>  (lowercase words, for O(1) validation)
//   WORDZ.words  → string[]      (for deriving random solvable letter pairs)
//   WORDZ.ready  → Promise       (resolves once loaded; rejects → honor-system fallback)
//
// The game works before this resolves (WZEngine.validate falls back to a
// letter-only check when the Set is empty), then tightens up once words load.

const WORDZ = (() => {
  const dict  = new Set();
  const words = [];

  const ready = fetch('data/words.txt')
    .then(res => {
      if (!res.ok) throw new Error('words_http_' + res.status);
      return res.text();
    })
    .then(text => {
      const list = text.split('\n');
      for (let i = 0; i < list.length; i++) {
        const w = list[i].trim();
        if (w) { dict.add(w); words.push(w); }
      }
      return dict;
    })
    .catch(err => {
      console.warn('WordZ dictionary failed to load — using honor-system fallback.', err);
      return dict; // empty Set → letter-only validation
    });

  return { dict, words, ready };
})();
