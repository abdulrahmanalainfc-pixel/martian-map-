/* =====================================================================
   ui.js — application chrome: modes, toasts, dialogs, tabs, theme,
   side-panel toggles, status bar, keyboard shortcuts.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state } = M;
  const { $, $$, esc } = U;
  const ui = (M.ui = {});

  /* ---------- Interaction modes (one active at a time) ---------- */
  const MODE_TEXT = {
    haz: 'Click the map to place hazard markers',
    route: 'Click the map to add route points · Backspace undoes',
    measure: 'Click the map to measure distance · Backspace undoes'
  };
  M.mode = {
    set(m) {
      m = m || null;
      const prev = state.mode;
      if (prev === m) return;
      state.mode = m;
      document.body.dataset.mode = m || '';
      M.map.getContainer().classList.toggle('xh', !!m);
      if (m) M.map.doubleClickZoom.disable(); else M.map.doubleClickZoom.enable(); // a double-click used to add two points
      M.emit('mode', { mode: m, prev });
    },
    toggle(m) { this.set(state.mode === m ? null : m); }
  };

  /* ---------- Toasts ---------- */
  ui.toast = function (msg, opts = {}) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (opts.type || 'info');
    el.setAttribute('role', opts.type === 'error' ? 'alert' : 'status');
    const span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    let timer;
    const close = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    if (opts.action) {
      const b = document.createElement('button');
      b.className = 'act'; b.textContent = opts.action.label;
      b.onclick = () => { opts.action.fn(); close(); };
      el.appendChild(b);
    }
    const x = document.createElement('button');
    x.className = 'x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '✕'; x.onclick = close;
    el.appendChild(x);
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    timer = setTimeout(close, opts.ms || (opts.action ? 7000 : 3500));
  };

  /* ---------- Banner (top of map) ---------- */
  let bannerTimer;
  ui.banner = function (text, ms = 0) {
    const b = $('#ban');
    b.textContent = text; b.dataset.kind = 'info'; b.hidden = false;
    clearTimeout(bannerTimer);
    if (ms) bannerTimer = setTimeout(() => { if (b.dataset.kind === 'info') b.hidden = true; }, ms);
  };

  /* ---------- Dialogs ---------- */
  ui.dialog = (html) => { $('#dbody').innerHTML = html; const d = $('#dlg'); if (!d.open) d.showModal(); };

  ui.ask = ({ title, label, value = '', ok = 'Save' }) => new Promise((resolve) => {
    const d = $('#askDlg'), inp = $('#askInput');
    $('#askTitle').textContent = title;
    $('#askLabel').textContent = label;
    $('#askOk').textContent = ok;
    inp.value = value;
    const onClose = () => { d.removeEventListener('close', onClose); resolve(d.returnValue === 'ok' ? inp.value.trim() : null); };
    d.addEventListener('close', onClose);
    d.returnValue = '';
    d.showModal();
    inp.focus(); inp.select();
  });

  ui.openHelp = () => ui.dialog(`
    <h3>Keyboard shortcuts</h3>
    <table class="keys"><tbody>
      <tr><td><kbd>/</kbd></td><td>Search sites, hazards or coordinates</td></tr>
      <tr><td><kbd>H</kbd></td><td>Place a hazard marker</td></tr>
      <tr><td><kbd>R</kbd></td><td>Add route points</td></tr>
      <tr><td><kbd>M</kbd></td><td>Measure distance</td></tr>
      <tr><td><kbd>Backspace</kbd></td><td>Undo last route / measure point</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Leave the current tool</td></tr>
      <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>Layers · Sites · Hazards · Route · Weather</td></tr>
      <tr><td><kbd>[</kbd> <kbd>]</kbd></td><td>Hide / show left and right panels</td></tr>
      <tr><td><kbd>G</kbd></td><td>Lat / lon graticule</td></tr>
      <tr><td><kbd>L</kbd></td><td>Jump to the landing site</td></tr>
      <tr><td><kbd>T</kbd></td><td>Switch theme</td></tr>
      <tr><td><kbd>F</kbd></td><td>Full screen</td></tr>
      <tr><td><kbd>?</kbd></td><td>This help</td></tr>
    </tbody></table>
    <h3>Marker legend</h3>
    <p class="legend-line"><span class="pin-sample" style="background:#4fd1a5"></span> Verified site
      <span class="pin-sample" style="background:#ffb347"></span> Interpreted site
      <span class="pin-sample star-s">★</span> Bookmark</p>
    <p class="legend-line">Hazard ring colour = risk:
      ${CFG.risks.map((r) => `<span class="pin-sample" style="background:#555;box-shadow:0 0 0 3px ${CFG.riskColors[r]}"></span> ${r}`).join(' ')}</p>
    <p class="k">Search understands coordinates in several forms: <span class="mono">18.44, 77.45</span> · <span class="mono">18.44N 77.45E</span> · <span class="mono">-5.4 137.8</span> · <span class="mono">18°26′41″N 77°27′3″E</span></p>`);

  ui.openSources = () => ui.dialog(`
    <h3>Data sources &amp; methodology</h3>
    <p><span class="tag ver">Live NASA imagery</span> Base maps and infrared overlays are tiles streamed from NASA Trek (trek.nasa.gov), built from Viking MDIM 2.1, MGS MOLA and Mars Odyssey THEMIS data (NASA/JPL/USGS). Global layers are 100–463 m per pixel; CTX (about 6 m) and HiRISE (25 cm) cover Jezero only. Rover-scale features are visible only in HiRISE, and only inside the landing area.</p>
    <p><span class="tag ver">Backup sources</span> If a layer loads nothing, MAREX switches by itself: Mars Trek → the same layer on api.nasa.gov → USGS Astrogeology WMS (Viking colour, THEMIS day and night) → Esri / Murray Lab global CTX mosaic. The bottom bar shows which source is live.</p>
    <p><span class="tag int">Interpreted</span> Site positions are approximate, read from public maps. Descriptions are summaries, not measurements.</p>
    <p><span class="tag sim">Demo / user data</span> Subsurface candidates are placeholders. Hazard markers and risk levels are your own annotations, saved only in this browser. Routes and measurements are straight lines using Mars' radius (${CFG.marsRadiusKm} km); route warnings compare only against your own markers.</p>
    <p><span class="tag ver">Numerical DEM (you load it)</span> Any uncompressed 32-bit float, simple-cylindrical GeoTIFF of Mars that you choose (for example the USGS/JPL Mars 2020 CTX DEM at Jezero, 20 m/px, about 87 MB; for Gale, the 30 m HRSC DTM from UCL on Zenodo). Elevation, slope (Horn method) and roughness (RMS residual from a plane over a 5×5 pixel window) are computed in your browser. Nothing is uploaded.</p>
    <p><span class="tag int">Mars clock (computed)</span> Mars time, sol, season and sun position come from the NASA/GISS Mars24 algorithm (Allison &amp; McEwen 2000). They are astronomy, not weather. Measured values in the Weather tab are dated Perseverance MEDA reports; no public live feed exists.</p>
    <p><span class="tag sim">Illustrative</span> Route-option scores use provisional weights (slope ${Math.round(CFG.w.slope * 100)} %, roughness ${Math.round(CFG.w.rough * 100)} %, hazard proximity ${Math.round(CFG.w.haz * 100)} %, data uncertainty ${Math.round(CFG.w.unc * 100)} %), a ${CFG.steepDeg}° steep limit and a ${CFG.impassableDeg}° no-go limit. They are not validated and not rover specifications.</p>
    <p><b>Where each feature works:</b> Viking colour, MOLA and THEMIS day infrared are global; THEMIS night infrared covers 60°N–60°S. CTX and HiRISE mosaics, demo candidates and the MEDA readings are Jezero only. Curated sites exist for Jezero, Gale and Olympus Mons. Terrain tools work anywhere you load a suitable elevation file. Hazard markers, bookmarks, search, measuring, straight-line routes and the Mars clock work anywhere. Unavailable options are greyed out and say why.</p>
    <p><b>Not included:</b> the USGS SIM 3464 geologic map, CRISM minerals, live Perseverance/MEDA data and real subsurface detections. A 20 m DEM cannot see rocks or small craters.</p>
    <p><b>Limitations:</b> This is a prototype, not a navigation or hazard-detection system. Never use it to judge real safety.</p>
    <p>Sources: <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noopener">NASA Trek</a> · <a href="https://astrogeology.usgs.gov/" target="_blank" rel="noopener">USGS Astrogeology</a> · <a href="https://www.uahirise.org/" target="_blank" rel="noopener">HiRISE</a></p>
    <p class="k">MAREX v${esc(CFG.version)}</p>`);

  /* ---------- Tabs ---------- */
  const TABS = ['lay', 'sit', 'haz', 'rou', 'wea'];
  ui.tab = function (t) {
    if (!TABS.includes(t)) t = 'lay';
    $$('#tabs button').forEach((b) => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    TABS.forEach((s) => { $('#' + s).hidden = s !== t; });
    U.store.set('tab', t);
  };

  /* ---------- Theme ---------- */
  const setTheme = (t) => {
    document.documentElement.dataset.theme = t; U.store.set('theme', t);
    const mt = document.querySelector('meta[name=theme-color]');
    if (mt) mt.content = t === 'dust' ? '#f3e9df' : '#120b0a';
  };
  ui.toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dust' ? 'ops' : 'dust');

  /* ---------- Side panels ---------- */
  ui.togglePanel = function (side) {
    const cls = 'hide-' + side;
    const on = document.body.classList.toggle(cls);
    U.store.set(cls, on);
    const btn = $(side === 'left' ? '#toggleL' : '#toggleR');
    if (btn) btn.setAttribute('aria-pressed', String(!on));
    setTimeout(() => M.map.invalidateSize(), 280);
  };

  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  ui.fullscreen = function () {
    if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return fsFallback();
    const p = req.call(el);
    if (p && p.catch) p.catch(fsFallback);
  };
  // No Fullscreen API (iPhone Safari): hide both panels instead so the map fills the window.
  function fsFallback() {
    const cl = document.body.classList, hide = !(cl.contains('hide-left') && cl.contains('hide-right'));
    ['left', 'right'].forEach((s) => { if (cl.contains('hide-' + s) !== hide) ui.togglePanel(s); });
  }

  /* ---------- Status bar & imagery health ---------- */
  function paintStatus() {
    const map = M.map, z = map.getZoom();
    const base = CFG.base.find((b) => b.id === state.curBase);
    const mpp = (360 / (512 * Math.pow(2, z))) * (Math.PI / 180) * CFG.marsRadiusKm * 1000;
    const over = z - base.native;
    $('#b2').textContent = `Zoom ${z} · ≈${mpp < 10 ? mpp.toFixed(1) : Math.round(mpp)} m/px` + (over > 0 ? ` · overzoomed ×${Math.pow(2, over)} (no extra detail)` : '');

    const on = [base].concat(CFG.overlays.filter((c) => map.hasLayer(M.ovL[c.id])));
    $('#b3').textContent = 'Layers: ' + on.map((c) => c.name).join(' + ');
    // 'live (NASA Trek)' also tells which of the backup sources is serving the layer
    const st = on.map((c) => { const t = M.TS[c.id] || { ok: 0, bad: 0 }; return M.why(c) && !t.ok ? 'not covered here' : t.ok ? `live (${t.src})` : t.bad ? 'FAILED' : 'loading'; });
    $('#b4').textContent = `DEM: ${M.terrain && M.terrain.has() ? 'loaded' : 'not loaded'} · Imagery: ${st.join(' / ')} · Hazards ${state.haz.length} (saved in this browser)`;

    const pill = $('#net'), isLive = (s) => s.startsWith('live');
    const allLive = st.filter((s) => s !== 'not covered here').every(isLive), anyBad = st.includes('FAILED');
    pill.dataset.s = allLive ? 'ok' : anyBad ? 'bad' : 'wait';
    pill.querySelector('span').textContent = allLive ? 'NASA imagery live' : anyBad ? (st.some(isLive) ? 'Some layers failed' : 'Imagery offline') : 'Loading imagery…';

    // The Viking backdrop is always on, so it is the one that tells whether imagery works at all.
    const b = $('#ban'), t = M.TS.vis;
    if (t && !t.ok && t.bad > 3) {
      b.textContent = 'NASA imagery did not load from any source (NASA Trek, api.nasa.gov, USGS). Check your internet connection, or the tileset names in js/config.js. No substitute data is shown.';
      b.dataset.kind = 'fail'; b.hidden = false;
    } else if (b.dataset.kind === 'fail') { b.hidden = true; b.dataset.kind = ''; }
  }

  ui.goLanding = () => {
    const s = CFG.sites.find((x) => x.kind === 'Landing site');
    if (!s) return;
    M.goTo(s.ll, 11); M.inspect.site(s);
  };

  /* ---------- Init ---------- */
  ui.init = function () {
    // theme: saved choice, else the OS preference
    const savedTheme = U.store.get('theme', null);
    setTheme(savedTheme || (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'dust' : 'ops'));

    // regions
    $('#reg').innerHTML = CFG.regions.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    $('#reg').value = M.region().id;
    $('#reg').onchange = (e) => M.setRegion(e.target.value);

    // header buttons
    $('#home').onclick = () => M.setRegion(M.region().id);
    $('#loc').onclick = ui.goLanding;
    $('#link').onclick = async () => { const ok = await U.copy(M.permalink()); ui.toast(ok ? 'Link to this view copied' : 'Copy failed', { type: ok ? 'ok' : 'error' }); };
    $('#th').onclick = ui.toggleTheme;
    $('#fs').onclick = ui.fullscreen;
    ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => { $('#fs').textContent = fsEl() ? '✕' : '⛶'; M.map.invalidateSize(); M.mini.invalidateSize(); }));
    $('#help').onclick = ui.openHelp;
    $('#src').onclick = ui.openSources;
    $('#toggleL').onclick = () => ui.togglePanel('left');
    $('#toggleR').onclick = () => ui.togglePanel('right');
    ['left', 'right'].forEach((s) => { if (U.store.get('hide-' + s, false)) { document.body.classList.add('hide-' + s); $(s === 'left' ? '#toggleL' : '#toggleR').setAttribute('aria-pressed', 'false'); } });
    $$('dialog').forEach((d) => d.addEventListener('click', (e) => {   // close only when the click is really outside the box
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    }));

    // tabs (with arrow-key navigation)
    $$('#tabs button').forEach((b) => {
      b.onclick = () => ui.tab(b.dataset.t);
      b.onkeydown = (e) => {
        const i = TABS.indexOf(b.dataset.t);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
          ui.tab(n); $(`#tabs [data-t=${n}]`).focus();
        }
      };
    });
    ui.tab(U.store.get('tab', 'lay'));

    // map toolbar + mode chip
    $$('#tools [data-mode]').forEach((b) => { b.onclick = () => M.mode.toggle(b.dataset.mode); });
    $('#chipX').onclick = () => M.mode.set(null);
    let measureText = '';
    const paintChip = () => {
      const m = state.mode, chip = $('#modeChip');
      chip.hidden = !m;
      if (m) $('#chipText').textContent = MODE_TEXT[m] + (m === 'measure' && measureText ? ' · ' + measureText : '') + ' · Esc to finish';
      $$('#tools [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    };
    M.on('mode', paintChip);
    M.on('measure', (t) => { measureText = t; paintChip(); });

    // status bar
    M.map.on('mousemove', (e) => { $('#b1').textContent = U.fmt([e.latlng.lat, e.latlng.lng]); });
    M.map.on('zoomend', paintStatus);
    M.on('status', U.debounce(paintStatus, 120));
    M.on('fmt', () => { /* panels re-render themselves */ });
    paintStatus();

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (document.querySelector('dialog[open]')) return;
      const t = e.target, typing = t.matches && t.matches('input,textarea,select,[contenteditable]');
      if (e.key === 'Escape' && !typing) { if (state.mode) M.mode.set(null); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case '/': e.preventDefault(); $('#q').focus(); break;
        case 'h': M.mode.toggle('haz'); break;
        case 'r': M.mode.toggle('route'); break;
        case 'm': M.mode.toggle('measure'); break;
        case 'g': M.layersPanel.toggle('grat'); break;
        case 'l': ui.goLanding(); break;
        case 't': ui.toggleTheme(); break;
        case 'f': ui.fullscreen(); break;
        case '?': ui.openHelp(); break;
        case '[': ui.togglePanel('left'); break;
        case ']': ui.togglePanel('right'); break;
        case '1': case '2': case '3': case '4': case '5': ui.tab(TABS[+e.key - 1]); break;
        case 'backspace':
          if (state.mode === 'route') { e.preventDefault(); M.route.undo(); }
          else if (state.mode === 'measure') { e.preventDefault(); M.measure.undo(); }
          break;
        default: break;
      }
    });
  };
})(window.MAREX);
