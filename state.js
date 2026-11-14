/* =====================================================================
   state.js — the single shared state object. Modules read/write it and
   persist through U.store; they talk to each other via M.on / M.emit.
   ===================================================================== */
(function (M) {
  'use strict';
  const { U, CFG } = M;
  const arr = (v) => (Array.isArray(v) ? v : []);

  // Bookmarks get stable ids: list indices shift on delete, which used to
  // make the inspector rename / remove the wrong bookmark.
  const seen = new Set();
  let nextId = 1;
  const bookmarks = arr(U.store.get('bm', []))
    .filter((b) => b && U.valid(b.ll))
    .map((b) => {
      let id = Number.isInteger(b.id) && b.id > 0 && !seen.has(b.id) ? b.id : 0;
      if (!id) { while (seen.has(nextId)) nextId++; id = nextId; }
      seen.add(id);
      return { id, n: String(b.n || 'Bookmark').slice(0, 60), ll: U.normLon(b.ll) };
    });

  const speed = +U.store.get('speed', 1);

  M.state = {
    haz: arr(U.store.get('haz', [])),            // sanitised in hazards.js
    routes: arr(U.store.get('routes', [])),      // sanitised in route.js
    bookmarks,
    filt: { cat: null, risk: null, q: '' },
    sort: 'new',
    mode: null,                                  // null | 'haz' | 'route' | 'measure'
    rt: { p: arr(U.store.get('rt', [])).filter(U.valid).map((q) => U.normLon(q)) }, // current route: first = A, last = B
    speed: Number.isInteger(speed) && speed >= 0 && speed < CFG.speeds.length ? speed : 1,
    coordFmt: U.store.get('fmt', 'dec') === 'dms' ? 'dms' : 'dec',
    curBase: 'vis'
  };
})(window.MAREX);
