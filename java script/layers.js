/* =====================================================================
   layers.js — "Layers" tab: base imagery, overlays (opacity), annotation
   groups, coordinate format. Choices persist between visits.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state } = M;
  const { $, $$, esc } = U;

  const KEY = 'layers';
  const GROUPS = [['sites', 'Sites of interest'], ['bm', 'Bookmarks'], ['haz', 'Hazard markers'], ['cands', 'Subsurface candidates (demo)'], ['grat', 'Lat / lon graticule']];
  const DEFAULT_G = { sites: true, bm: true, haz: true, cands: false, grat: false };
  const cfg = U.store.get(KEY, {}) || {};
  const save = () => U.store.set(KEY, cfg);

  const P = (M.layersPanel = {});

  // The Viking mosaic ('vis') is a permanent backdrop. Any other base is drawn above it, so layers that only
  // cover part of the planet (CTX, HiRISE) never leave a hole around their edges.
  function showBase(id) {
    if (state.curBase !== 'vis') M.map.removeLayer(M.baseL[state.curBase]);
    state.curBase = id;
    if (id !== 'vis') M.baseL[id].addTo(M.map);
  }

  function setBase(id) {
    if (!M.baseL[id] || id === state.curBase) return;
    showBase(id);
    cfg.base = id; save(); M.syncHash();
    P.render(); M.emit('status');
    // Small-area layers: tell the user when they are looking somewhere the layer does not cover.
    const c = CFG.base.find((x) => x.id === id);
    if (c && c.bounds && !L.latLngBounds(c.bounds).contains(M.map.getCenter())) {
      M.ui.toast(`${c.name} covers only a small area.`, { action: { label: 'Go there', fn: () => M.fitTo(c.bounds, CFG.maxZoom) }, ms: 7000 });
    }
  }

  function setOverlay(id, on) {
    const l = M.ovL[id];
    if (!l) return;
    if (on) l.addTo(M.map); else M.map.removeLayer(l);
    cfg.ov = cfg.ov || {};
    cfg.ov[id] = Object.assign({}, cfg.ov[id], { on });
    save();
    P.render(); M.emit('status');
  }

  function setGroup(k, on) {
    if (!M.G[k]) return;
    if (on) M.G[k].addTo(M.map); else M.map.removeLayer(M.G[k]);
    cfg.g = cfg.g || {};
    cfg.g[k] = on; save();
  }

  P.groupOn = (k) => M.map.hasLayer(M.G[k]);
  P.toggle = (k) => { setGroup(k, !P.groupOn(k)); P.render(); };
  P.setBase = setBase;
  const off = (c, cur) => !!M.why(c) && !cur;
  const whyTag = (c) => (M.why(c) ? ` <span class="tag unc">Not here: ${M.why(c)}</span>` : '');
  const gReason = (k) => (k === 'sites' && !M.hasSites() ? 'None mapped here' : k === 'cands' && !M.atJez() ? 'Jezero only' : '');
  const gOff = (k) => !!gReason(k) && !P.groupOn(k);

  P.init = function () {
    // restore saved choices
    const want = (M.startHash && M.baseL[M.startHash.b] && M.startHash.b) || cfg.base; // shared link wins over saved choice
    if (want && M.baseL[want] && want !== state.curBase) showBase(want);
    CFG.overlays.forEach((c) => {
      const s = cfg.ov && cfg.ov[c.id];
      if (!s) return;
      if (isFinite(s.op)) M.ovL[c.id].setOpacity(Math.min(1, Math.max(0.1, s.op)));
      if (s.on) M.ovL[c.id].addTo(M.map);
    });
    GROUPS.forEach(([k]) => {
      const on = cfg.g && typeof cfg.g[k] === 'boolean' ? cfg.g[k] : DEFAULT_G[k];
      if (on) M.G[k].addTo(M.map); else M.map.removeLayer(M.G[k]);
    });

    const el = $('#lay');
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'base') setBase(t.value);
      else if (t.dataset.ov) setOverlay(t.dataset.ov, t.checked);
      else if (t.dataset.g) setGroup(t.dataset.g, t.checked);
    });
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.dataset.op) return;
      const v = Math.min(100, Math.max(10, +t.value)) / 100;
      M.ovL[t.dataset.op].setOpacity(v);
      const out = t.parentElement.querySelector('output');
      if (out) out.textContent = Math.round(v * 100) + '%';
      cfg.ov = cfg.ov || {};
      cfg.ov[t.dataset.op] = Object.assign({}, cfg.ov[t.dataset.op], { op: v });
      save();
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fmt]');
      if (!b) return;
      state.coordFmt = b.dataset.fmt === 'dms' ? 'dms' : 'dec';
      U.store.set('fmt', state.coordFmt);
      P.render(); M.emit('fmt');
    });
    P.render();
  };

  const renderHTML = function () {
    const nirOn = M.map.hasLayer(M.ovL.nir);
    $('#lay').innerHTML =
      `<h4>Base imagery <span class="hint">one at a time</span></h4>
       <div class="stack" role="radiogroup" aria-label="Base imagery">` +
      CFG.base.map((c) => `
        <label class="card choice ${c.id === state.curBase ? 'on' : ''} ${off(c, c.id === state.curBase) ? 'off' : ''}">
          <input type="radio" name="base" value="${c.id}" ${c.id === state.curBase ? 'checked' : ''} ${off(c, c.id === state.curBase) ? 'disabled' : ''}>
          <span class="dot" data-st="${c.id}"></span>
          <span class="grow"><b>${esc(c.name)}</b>${whyTag(c)}<small>${esc(c.desc)}</small></span>
        </label>`).join('') +
      `</div>
       <h4>Data overlays <span class="hint">stack any</span></h4>
       <div class="stack">` +
      CFG.overlays.map((c) => {
        const on = M.map.hasLayer(M.ovL[c.id]);
        const op = Math.round(M.ovL[c.id].options.opacity * 100);
        return `
        <div class="card ${on ? 'on' : ''} ${off(c, on) ? 'off' : ''}">
          <label class="row-sw">
            <span class="dot" data-st="${c.id}"></span>
            <span class="grow"><b>${esc(c.name)}</b>${whyTag(c)}<small>${esc(c.desc)}</small></span>
            <span class="switch"><input type="checkbox" data-ov="${c.id}" ${on ? 'checked' : ''} ${off(c, on) ? 'disabled' : ''} aria-label="Show ${esc(c.name)}"><i></i></span>
          </label>
          <div class="slider"><input type="range" min="10" max="100" value="${op}" data-op="${c.id}" aria-label="Opacity of ${esc(c.name)}"><output>${op}%</output></div>
        </div>`;
      }).join('') +
      `</div>` +
      (nirOn ? `<div class="legend"><div class="lg"></div><div class="lg-lab"><span>cooler</span><span>warmer (night IR)</span></div></div>` : '') +
      `<div id="demBox"></div><h4>Annotations <span class="hint">your own layers</span></h4>
       <div class="stack">` +
      GROUPS.map(([k, t]) => `
        <label class="card row-sw slim ${gOff(k) ? 'off' : ''}">
          <span class="grow">${esc(t)}${gReason(k) ? ` <small style="display:inline">· ${gReason(k)}</small>` : ''}</span>
          <span class="switch"><input type="checkbox" data-g="${k}" ${P.groupOn(k) ? 'checked' : ''} ${gOff(k) ? 'disabled' : ''}><i></i></span>
        </label>`).join('') +
      `</div>
       <h4>Coordinate format</h4>
       <div class="seg" role="group" aria-label="Coordinate format">
         <button data-fmt="dec" aria-pressed="${state.coordFmt === 'dec'}">Decimal</button>
         <button data-fmt="dms" aria-pressed="${state.coordFmt === 'dms'}">° ′ ″</button>
       </div>
       <div class="note">Zooming past a dataset's native resolution enlarges pixels; it does not add detail. Nothing here is measured at rover scale.</div>
       <div class="legend-tags"><span class="tag ver">Live NASA imagery</span><span class="tag int">Interpreted</span><span class="tag sim">Demo data</span></div>`;
    if (M.terrain) M.terrain.mount();
    P.paint();
  };

  // Re-rendering replaces the DOM; put keyboard focus back on the control the user was using.
  P.render = function () {
    const root = $('#lay'), a = document.activeElement;
    let key = null;
    if (a && root.contains(a)) {
      if (a.dataset.ov) key = `[data-ov="${a.dataset.ov}"]`;
      else if (a.dataset.g) key = `[data-g="${a.dataset.g}"]`;
      else if (a.dataset.fmt) key = `[data-fmt="${a.dataset.fmt}"]`;
      else if (a.name === 'base') key = `[name="base"][value="${a.value}"]`;
    }
    renderHTML();
    const n = key && $(key, root);
    if (n) n.focus();
  };

  // status dots next to each imagery layer
  P.paint = function () {
    $$('[data-st]').forEach((d) => {
      const t = M.TS[d.dataset.st];
      d.className = 'dot ' + (t && t.ok ? 'live' : t && t.bad ? 'failed' : 'wait');
      d.title = t && t.ok ? 'Live · source: ' + t.src : t && t.bad ? 'Tiles failed to load (' + t.src + ')' : 'Not loaded yet';
    });
  };
  M.on('avail', () => P.render());
  M.on('status', U.debounce(P.paint, 150)); // fired on every tile: never repaint per tile
})(window.MAREX);
