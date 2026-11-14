/* =====================================================================
   inspector.js — right-hand panel: point / site / candidate / bookmark /
   hazard / measurement details, with nearest-feature context.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state, STATUS } = M;
  const { $, esc } = U;
  const I = (M.inspect = {});

  let current = null; // { ll, redraw }

  const shell = (title, tag, body) => `<div class="ihead"><b>${title}</b>${tag || ''}</div>${body}`;
  const coordRow = (ll, label = 'Latitude / longitude') => `
    <div class="k">${label}</div>
    <div class="coord"><span class="mono">${U.fmt(ll)}</span>
      <button class="btn sm" data-copy="${ll[0].toFixed(6)}, ${ll[1].toFixed(6)}" title="Copy decimal coordinates">Copy</button></div>`;
  const terrain = (ll) => (M.terrain ? M.terrain.html(ll) : '<div class="k">Elevation</div><div class="mono dim">not available</div>');

  /* ---------- Context: distances computed from the data we do have ---------- */
  function context(ll, skipHazId) {
    const rows = [];
    const d0 = U.hav(CFG.landing, ll);
    rows.push(['From landing site', d0 < 0.005 ? 'at the landing site' : `${U.fmtDist(d0)} · ${U.fmtBearing(U.bearing(CFG.landing, ll))}`]);

    let near = null;
    CFG.sites.forEach((s) => { const d = U.hav(ll, s.ll); if (d > 0.005 && (!near || d < near.d)) near = { s, d }; });
    if (near) rows.push(['Nearest site', `${esc(near.s.n)} · ${U.fmtDist(near.d)} ${U.compass(U.bearing(ll, near.s.ll))}`]);

    let nh = null;
    state.haz.forEach((h) => { if (h.id === skipHazId) return; const d = U.hav(ll, h.ll); if (!nh || d < nh.d) nh = { h, d }; });
    if (nh) rows.push(['Nearest hazard', `#${nh.h.id} ${esc(M.hazards.catOf(nh.h.cat)[1])} · ${U.fmtDist(nh.d)} ${U.compass(U.bearing(ll, nh.h.ll))}`]);

    let html = `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    const inside = state.haz.filter((h) => h.id !== skipHazId && U.hav(ll, h.ll) <= CFG.hazardRadiusKm);
    if (inside.length) html += `<div class="note warn">⚠ Inside the ${CFG.hazardRadiusKm} km halo of ${inside.map((h) => '#' + h.id).join(', ')}.</div>`;
    return html;
  }

  const actions = () => `
    <h4>Actions</h4>
    <div class="btn-row">
      <button class="btn" data-act="bookmark">★ Bookmark</button>
      <button class="btn" data-act="hazard">⚠ Hazard here</button>
    </div>
    <div class="btn-row">
      <button class="btn" data-act="route">➜ Add to route</button>
      <button class="btn" data-act="centre">⌖ Centre</button>
    </div>`;

  function show(html, ll, redraw, key) {
    $('#info').innerHTML = html;
    current = { ll, redraw, key };
    if (document.body.classList.contains('hide-right')) M.ui.togglePanel('right'); // reveal the inspector if it was hidden
  }

  /* ---------- Views ---------- */
  I.empty = function (msg) {
    current = null;
    M.G.pick.clearLayers();
    $('#info').innerHTML = msg ? `<p class="k">${esc(msg)}</p>` : `
      <div class="empty">
        <b>Nothing selected</b>
        <p>Click the map to inspect a coordinate, or pick a site from the <em>Sites</em> tab.</p>
        <p class="k">Tip: press <kbd>?</kbd> to see keyboard shortcuts.</p>
      </div>`;
  };

  I.point = function (ll) {
    ll = Array.isArray(ll) ? ll : [ll.lat, ll.lng];
    M.G.pick.clearLayers();
    L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#ff7a45', fillOpacity: 1 }).addTo(M.G.pick);
    const draw = () => shell('Inspected point', '', coordRow(ll) + terrain(ll) + context(ll) +
      `<div class="k">Source</div><p>A coordinate you picked. No elevation or slope is read from a dataset in this prototype.</p>` + actions());
    show(draw(), ll, draw);
  };

  I.site = function (s) {
    M.G.pick.clearLayers();
    const [t, c] = STATUS[s.st];
    const draw = () => shell(esc(s.n), `<span class="tag ${c}">${t}</span>`,
      coordRow(s.ll, 'Coordinates (approximate)') + `<div class="k">Type</div><p>${esc(s.kind)}</p><div class="k">Description</div><p>${esc(s.txt)}</p>` +
      terrain(s.ll) + context(s.ll) + `<div class="k">Source</div><p>Public NASA/USGS descriptions; position read approximately from imagery.</p>` + actions());
    show(draw(), s.ll, draw);
  };

  I.cand = function (c) {
    M.G.pick.clearLayers();
    const draw = () => shell(esc(c.n), `<span class="tag sim">Demo · unconfirmed</span>`,
      coordRow(c.ll) + `<p>A placeholder showing how potential subsurface features would be drawn. It is <b>not</b> a detected cave, void or lava tube. Replace the entries in <code>CFG.cands</code> (js/config.js) with surveyed candidates from published research.</p>` +
      context(c.ll) + actions());
    show(draw(), c.ll, draw);
  };

  I.bookmark = function (id) {
    const b = M.sites.get(id);
    if (!b) return;
    M.G.pick.clearLayers();
    const draw = () => shell('★ ' + esc(b.n), '<span class="tag int">Bookmark</span>',
      coordRow(b.ll) + terrain(b.ll) + context(b.ll) +
      `<h4>Actions</h4><div class="btn-row"><button class="btn" data-act="rename" data-id="${b.id}">✎ Rename</button><button class="btn danger" data-act="unbookmark" data-id="${b.id}">Remove</button></div>
       <div class="btn-row"><button class="btn" data-act="hazard">⚠ Hazard here</button><button class="btn" data-act="route">➜ Add to route</button><button class="btn" data-act="centre">⌖ Centre</button></div>`);
    show(draw(), b.ll, draw, 'bm:' + id);
  };

  I.haz = function (h) {
    M.G.pick.clearLayers();
    const opts = (list, v) => list.map((x) => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
    const draw = () => shell(`Hazard #${h.id}`, '<span class="tag sim">User annotation</span>',
      coordRow(h.ll) +
      `<div class="k">Category</div>
       <select class="field block" data-f="cat">${CFG.cats.map((c) => `<option value="${c[0]}" ${c[0] === h.cat ? 'selected' : ''}>${esc(c[1])}</option>`).join('')}</select>
       <div class="k">Risk (preliminary)</div>
       <div class="seg risk" role="group" aria-label="Risk level">${CFG.risks.map((r) => `<button data-risk="${r}" aria-pressed="${r === h.risk}" style="--c:${CFG.riskColors[r]}">${r}</button>`).join('')}</div>
       <div class="k">Confidence</div>
       <select class="field block" data-f="conf">${opts(CFG.confidences, h.conf)}</select>
       <div class="k">Description</div>
       <textarea class="field block" rows="4" data-f="desc" maxlength="2000" placeholder="What did you observe?">${esc(h.desc)}</textarea>
       <div class="k">Source</div>
       <input class="field block" data-f="src" maxlength="200" value="${esc(h.src)}">
       <div class="k">Observed: ${esc(h.date)}</div>` +
      terrain(h.ll) + context(h.ll, h.id) +
      `<div class="btn-row"><button class="btn" data-act="centre">⌖ Centre</button><button class="btn" data-act="route">➜ Add to route</button><button class="btn danger" data-act="delhaz" data-id="${h.id}">Delete</button></div>
       <p class="k">Changes save automatically. Drag the marker to reposition it.</p>`);
    show(draw(), h.ll, draw);
    current.hazId = h.id;
  };

  I.measure = function () {
    const m = M.measure;
    const draw = () => {
      const s = m.stats(), legs = Math.max(0, m.pts.length - 1), sp = CFG.speeds[state.speed];
      return shell('Measurement', '<span class="tag int">Straight line</span>',
        `<div class="big">${U.fmtDist(s.d)}</div>
         <p class="k">${m.pts.length} points · ${legs} leg${legs === 1 ? '' : 's'} · at ${sp[1]} km/h ≈ ${U.fmtTime(s.d / sp[1])}</p>` +
        (s.area === null ? '' : `<dl class="kv"><dt>Closed perimeter</dt><dd>${U.fmtDist(s.perim)}</dd><dt>Enclosed area</dt><dd>${U.fmtArea(s.area)}</dd></dl>
         <p class="k">Area assumes straight edges and a closing leg back to the first point.</p>`) +
        `<div class="btn-row"><button class="btn" data-act="m-route">➜ Use as route</button><button class="btn danger" data-act="m-clear">Clear</button></div>`);
    };
    show(draw(), null, draw, 'measure');
  };

  I.refresh = () => { if (current && current.redraw) { $('#info').innerHTML = current.redraw(); } };
  I.dropIf = (key) => { if (current && current.key === key) I.empty(); };

  /* ---------- Events ---------- */
  I.init = function () {
    I.empty();
    const el = $('#info');

    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.copy) { const ok = await U.copy(b.dataset.copy); M.ui.toast(ok ? 'Coordinates copied' : 'Copy failed', { type: ok ? 'ok' : 'error' }); return; }
      if (b.dataset.risk && current && current.hazId) {
        const h = state.haz.find((x) => x.id === current.hazId);
        if (h) { M.hazards.update(h, { risk: b.dataset.risk }); I.haz(h); }
        return;
      }
      const ll = current && current.ll;
      switch (b.dataset.act) {
        case 'bookmark': M.sites.addBookmark(ll); break;
        case 'hazard': M.hazards.add(ll); break;
        case 'route': M.route.addPt(ll); M.ui.tab('rou'); break;
        case 'centre': M.goTo(ll, Math.max(M.map.getZoom(), 10)); break;
        case 'rename': M.sites.rename(+b.dataset.id); break;
        case 'unbookmark': M.sites.removeBookmark(+b.dataset.id); break;
        case 'delhaz': { const h = state.haz.find((x) => x.id === +b.dataset.id); if (h) M.hazards.remove(h); break; }
        case 'm-route': M.measure.toRoute(); break;
        case 'm-clear': M.measure.clear(); I.empty(); break;
        default: break;
      }
    });

    // Autosave hazard fields. One timer per (hazard, field) and the hazard id is captured when the
    // user types, so quick edits or switching markers can no longer drop or misdirect a change.
    const timers = {};
    const commit = (id, field, value) => { const h = state.haz.find((x) => x.id === id); if (h) M.hazards.update(h, { [field]: value }); };
    el.addEventListener('input', (e) => {
      const t = e.target, f = t.dataset.f;
      if (!f || t.tagName === 'SELECT' || !current || !current.hazId) return;
      const id = current.hazId, k = id + ':' + f;
      clearTimeout(timers[k]);
      timers[k] = setTimeout(() => commit(id, f, t.value), 350);
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.f && t.tagName === 'SELECT' && current && current.hazId) commit(current.hazId, t.dataset.f, t.value);
    });

    M.on('fmt', I.refresh);
    M.on('dem', I.refresh); // a DEM was loaded: refresh the open readout
    M.on('mode', ({ mode, prev }) => { if (prev === 'measure' && mode !== 'measure' && M.measure.pts.length > 1) I.measure(); });
    // live measurement readout while clicking points
    M.on('measure', () => {
      const n = M.measure.pts.length, showing = current && current.key === 'measure';
      if (n > 1 && (showing || state.mode === 'measure')) { if (showing) I.refresh(); else I.measure(); }
      else if (showing) I.empty();
    });
  };
})(window.MAREX);
