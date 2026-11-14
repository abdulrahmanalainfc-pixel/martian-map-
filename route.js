/* =====================================================================
   route.js — experimental straight-line route planner.
   Points are A, W1…Wn, B. Not terrain-aware: it only compares the line
   to the user's own hazard markers and never claims a route is safe.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state } = M;
  const { $, esc } = U;
  const Rt = (M.route = {});

  const P = () => state.rt.p;
  const label = (i, n) => (i === 0 ? 'A' : i === n - 1 ? 'B' : 'W' + i);

  /* ---------- Saved routes (migrates the old {a,b,w} shape) ---------- */
  function sanitizeSaved(r) {
    if (!r) return null;
    const p = Array.isArray(r.p) ? r.p : [r.a, ...(Array.isArray(r.w) ? r.w : []), r.b];
    const pts = p.filter(U.valid).map((q) => U.normLon(q));
    if (pts.length < 2) return null;
    return { n: String(r.n || 'Route').slice(0, 60), p: pts, d: isFinite(r.d) ? +r.d : 0, t: String(r.t || ''), n_w: isFinite(r.n_w) ? +r.n_w : 0 };
  }
  const persist = () => U.store.set('routes', state.routes);

  /* ---------- Editing ---------- */
  Rt.addPt = (ll) => { P().push([ll[0], ll[1]]); Rt.draw(); };
  Rt.undo = () => { if (P().length) { P().pop(); Rt.draw(); } };
  Rt.reverse = () => { P().reverse(); Rt.draw(); };
  Rt.clear = () => { state.rt.p = []; Rt.draw(); };
  Rt.remove = (i) => { P().splice(i, 1); Rt.draw(); };
  Rt.set = (pts) => { state.rt.p = pts.map((q) => [q[0], q[1]]); Rt.draw(); };

  /* ---------- Maths ---------- */
  const statsFor = function (p) {
    const n = p.length;
    let d = 0;
    const legs = [], hit = new Map();
    for (let i = 1; i < n; i++) {
      const a = p[i - 1], b = p[i], dd = U.hav(a, b);
      d += dd;
      legs.push({ from: label(i - 1, n), to: label(i, n), d: dd, brg: U.bearing(a, b) });
      state.haz.forEach((h) => { if (U.segDist(h.ll, a, b) <= CFG.hazardRadiusKm) hit.set(h.id, h); });
    }
    return { d, legs, hit: [...hit.values()], hours: d / CFG.speeds[state.speed][1] };
  };
  Rt.stats = () => statsFor(P());

  /* ---------- Drawing ---------- */
  Rt.draw = function () {
    if (M.terrain) M.terrain.clearOptions(); // old route options no longer match the route
    M.G.route.clearLayers();
    const p = P(), n = p.length;
    if (n > 1) L.polyline(p, { color: '#ffd166', weight: 3, dashArray: '8 6', interactive: false }).addTo(M.G.route);
    p.forEach((ll, i) => {
      const lab = label(i, n);
      L.marker(ll, {
        icon: L.divIcon({ className: '', iconSize: [22, 22], html: `<div class="pin rp">${lab}</div>` }),
        draggable: true, keyboard: true, alt: 'Route point ' + lab
      }).addTo(M.G.route)
        .on('click', (e) => L.DomEvent.stop(e))
        .on('dragend', (e) => { const q = e.target.getLatLng(); p[i] = [q.lat, q.lng]; Rt.draw(); });
    });
    U.store.set('rt', p); // the working route survives a reload
    Rt.render();
  };

  /* ---------- Panel ---------- */
  Rt.init = function () {
    state.routes = state.routes.map(sanitizeSaved).filter(Boolean);
    persist();

    const el = $('#rou');
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.act === 'add') M.mode.toggle('route');
      else if (d.act === 'undo') Rt.undo();
      else if (d.act === 'reverse') Rt.reverse();
      else if (d.act === 'clear') { Rt.clear(); M.mode.set(null); }
      else if (d.act === 'save') await Rt.save();
      else if (d.act === 'export') Rt.exportGeoJSON();
      else if (d.rm !== undefined) Rt.remove(+d.rm);
      else if (d.load !== undefined) Rt.load(+d.load);
      else if (d.del !== undefined) Rt.deleteSaved(+d.del);
      else if (d.hz !== undefined) { const h = state.haz.find((x) => x.id === +d.hz); if (h) { M.goTo(h.ll, Math.max(M.map.getZoom(), 10)); M.inspect.haz(h); } }
    });
    el.addEventListener('change', (e) => {
      if (e.target.id === 'sp') { state.speed = +e.target.value; U.store.set('speed', state.speed); Rt.render(); M.emit('speed'); }
    });
    M.on('mode', () => Rt.render());
    M.on('fmt', Rt.render);
    Rt.draw();
  };

  Rt.save = async function () {
    const s = Rt.stats();
    const raw = await M.ui.ask({ title: 'Save route', label: 'Route name', value: 'Route ' + (state.routes.length + 1) });
    if (raw === null) return;
    const name = raw || 'Route ' + (state.routes.length + 1);
    state.routes.push({ n: name.slice(0, 60), p: U.clone(P()), d: s.d, t: U.fmtTime(s.hours), n_w: s.hit.length });
    persist(); Rt.render();
    M.ui.toast('Route saved', { type: 'ok' });
  };

  Rt.load = function (i) {
    const r = state.routes[i];
    if (!r) return;
    const prev = U.clone(P());
    Rt.set(r.p);
    M.fitTo(L.latLngBounds(r.p).pad(0.3));
    if (prev.length) M.ui.toast(`Loaded "${r.n}"`, { action: { label: 'Undo', fn: () => Rt.set(prev) } });
  };

  Rt.deleteSaved = function (i) {
    const r = state.routes[i];
    if (!r) return;
    const snapshot = U.clone(state.routes);
    state.routes.splice(i, 1);
    persist(); Rt.render();
    M.ui.toast(`Deleted "${r.n}"`, { action: { label: 'Undo', fn: () => { state.routes = snapshot; persist(); Rt.render(); } } });
  };

  Rt.exportGeoJSON = function () {
    const p = P();
    if (p.length < 2) return M.ui.toast('Add at least two points first');
    const s = Rt.stats();
    const gj = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: p.map((q) => [q[1], q[0]]) }, properties: { distance_km: +s.d.toFixed(3), assumed_speed_kmh: CFG.speeds[state.speed][1], note: 'Straight-line planning route; not terrain-aware.' } },
        ...p.map((q, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q[1], q[0]] }, properties: { label: label(i, p.length) } }))
      ]
    };
    U.download('marex-route.geojson', JSON.stringify(gj, null, 2), 'application/geo+json');
    M.ui.toast('Route exported', { type: 'ok' });
  };

  Rt.render = function () {
    const el = $('#rou');
    if (!el) return;
    const p = P(), n = p.length, adding = state.mode === 'route';
    const s = n > 1 ? Rt.stats() : null;

    let h = `<h4>Experimental route</h4>
      <p class="k">Press <b>Add points</b>, then click the map to extend the route. Drag a pin to move it.</p>
      <div class="btn-row">
        <button class="btn primary" data-act="add" aria-pressed="${adding}">${adding ? '● Adding… (Esc to stop)' : '＋ Add points'} <kbd>R</kbd></button>
      </div>
      <div class="btn-row">
        <button class="btn sm" data-act="undo" ${n ? '' : 'disabled'}>↶ Undo</button>
        <button class="btn sm" data-act="reverse" ${n > 1 ? '' : 'disabled'}>⇅ Reverse</button>
        <button class="btn sm danger" data-act="clear" ${n ? '' : 'disabled'}>Clear</button>
      </div>`;

    h += n ? p.map((q, i) => `
      <div class="item-row"><div class="item static"><b class="lab">${label(i, n)}</b> <span class="mono">${U.fmtShort(q)}</span></div>
        <button class="icon-btn danger" data-rm="${i}" aria-label="Remove point ${label(i, n)}">✕</button></div>`).join('')
      : '<p class="k">No points yet.</p>';

    h += `<h4>Assumed speed</h4>
      <select class="field block" id="sp" aria-label="Assumed speed">${CFG.speeds.map((sp, i) => `<option value="${i}" ${i === state.speed ? 'selected' : ''}>${esc(sp[0])} · ${sp[1]} km/h</option>`).join('')}</select>
      <p class="k">A planning input, not mission data.</p>
      <h4>Summary</h4>`;

    if (s) {
      h += `<div class="summary"><div><span>Distance</span><b>${U.fmtDist(s.d)}</b></div><div><span>Est. time</span><b>${U.fmtTime(s.hours)}</b></div><div><span>Legs</span><b>${s.legs.length}</b></div></div>
        <table class="legs"><tbody>${s.legs.map((l) => `<tr><td>${l.from}→${l.to}</td><td>${U.fmtDist(l.d)}</td><td>${U.fmtBearing(l.brg)}</td></tr>`).join('')}</tbody></table>`;
      h += s.hit.length
        ? `<div class="note warn">⚠ Passes within ${CFG.hazardRadiusKm} km of ${s.hit.length} marked hazard${s.hit.length > 1 ? 's' : ''}:
             <div class="chips">${s.hit.map((x) => `<button class="chip" data-hz="${x.id}">#${x.id} ${esc(M.hazards.catOf(x.cat)[1])}</button>`).join('')}</div></div>`
        : '<div class="note">No marked hazards nearby. This does not mean the route is safe.</div>';
      h += M.terrain.routeBox();
      h += `<div class="btn-row"><button class="btn" data-act="save">Save route</button><button class="btn" data-act="export">⤓ GeoJSON</button></div>`;
    } else {
      h += '<p class="k">Set at least two points to see distance, time and hazard warnings.</p>';
    }

    h += `<h4>Saved routes <span class="count">${state.routes.length}</span></h4>`;
    h += state.routes.length ? state.routes.map((r, i) => `
      <div class="item-row">
        <button class="item" data-load="${i}"><b>${esc(r.n)}</b><small>${(() => { const q = statsFor(r.p); return `${U.fmtDist(q.d)} · ${U.fmtTime(q.hours)} · ${q.hit.length} hazard warning${q.hit.length === 1 ? '' : 's'}`; })()}</small></button>
        <button class="icon-btn danger" data-del="${i}" aria-label="Delete ${esc(r.n)}">✕</button>
      </div>`).join('') : '<p class="k">Nothing saved yet.</p>';

    h += `<div class="note">Not terrain-aware: no slope data is loaded, so a route is never claimed safe. Warnings only compare the straight line to your own hazard markers (radius ${CFG.hazardRadiusKm} km).</div>`;
    el.innerHTML = h;
    M.terrain.wireCmp();
  };
})(window.MAREX);
