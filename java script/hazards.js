/* =====================================================================
   hazards.js — user hazard markers: add / edit / delete (with undo),
   filter, sort, import / export (JSON, CSV, GeoJSON). Everything here
   is the user's own annotation, never verified data.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state } = M;
  const { $, esc } = U;
  const Z = (M.hazards = {});

  const catOf = (id) => CFG.cats.find((c) => c[0] === id) || CFG.cats[CFG.cats.length - 1];
  Z.catOf = catOf;
  const RANK = { High: 0, Moderate: 1, Low: 2, Unknown: 3 };

  /* ---------- Data hygiene ---------- */
  function sanitize(x, id) {
    return {
      id,
      ll: U.normLon(x.ll),
      cat: CFG.cats.some((c) => c[0] === x.cat) ? x.cat : 'oth',
      risk: CFG.risks.includes(x.risk) ? x.risk : 'Unknown',
      conf: CFG.confidences.includes(x.conf) ? x.conf : 'Low',
      desc: String(x.desc ?? '').slice(0, 2000),
      src: String(x.src ?? 'Imported').slice(0, 200),
      date: String(x.date ?? 'unknown').slice(0, 10)
    };
  }
  const nextId = () => state.haz.reduce((m, x) => Math.max(m, x.id), 0) + 1;

  function loadStored() {
    const seen = new Set();
    let next = 1;
    state.haz = state.haz.filter((x) => x && U.valid(x.ll)).map((x) => {
      let id = Number.isInteger(x.id) && x.id > 0 && !seen.has(x.id) ? x.id : 0;
      if (!id) { while (seen.has(next)) next++; id = next; }
      seen.add(id);
      return sanitize(x, id);
    });
  }

  /* ---------- Core operations ---------- */
  Z.visible = () => {
    const f = state.filt, q = f.q.toLowerCase();
    return state.haz.filter((h) =>
      (!f.cat || h.cat === f.cat) && (!f.risk || h.risk === f.risk) &&
      (!q || h.desc.toLowerCase().includes(q) || h.src.toLowerCase().includes(q) || catOf(h.cat)[1].toLowerCase().includes(q) || ('#' + h.id).includes(q)));
  };

  Z.commit = function () {
    U.store.set('haz', state.haz);
    Z.draw(); Z.render();
    if (M.route) M.route.render();
    M.emit('status');
  };

  Z.add = function (ll) {
    const h = sanitize({ ll, cat: 'oth', risk: 'Unknown', conf: 'Low', desc: '', src: 'User annotation', date: new Date().toISOString().slice(0, 10) }, nextId());
    state.haz.push(h);
    Z.commit();
    M.inspect.haz(h);
    M.ui.tab('haz');
  };

  Z.update = function (h, patch) {
    Object.assign(h, sanitize(Object.assign({}, h, patch), h.id));
    Z.commit();
  };

  // Undo puts back only the markers that were removed, so edits made since are never wiped.
  function restore(items) {
    items.forEach((x) => { const c = U.clone(x); if (state.haz.some((y) => y.id === c.id)) c.id = nextId(); state.haz.push(c); });
    Z.commit();
  }

  Z.remove = function (h) {
    const copy = U.clone(h);
    state.haz = state.haz.filter((x) => x.id !== h.id);
    Z.commit();
    M.inspect.empty();
    M.ui.toast(`Hazard #${h.id} deleted`, { action: { label: 'Undo', fn: () => restore([copy]) } });
  };

  Z.clearAll = function () {
    if (!state.haz.length) return M.ui.toast('There are no markers to clear');
    const removed = U.clone(state.haz), n = removed.length;
    state.haz = [];
    Z.commit();
    M.inspect.empty();
    M.ui.toast(`Cleared ${n} marker${n > 1 ? 's' : ''}`, { action: { label: 'Undo', fn: () => restore(removed) } });
  };

  /* ---------- Import / export ---------- */
  const stamp = () => new Date().toISOString().slice(0, 10);

  function toGeoJSON(list) {
    return {
      type: 'FeatureCollection',
      features: list.map((h) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.ll[1], h.ll[0]] },
        properties: { id: h.id, category: h.cat, risk: h.risk, confidence: h.conf, description: h.desc, source: h.src, date: h.date }
      }))
    };
  }

  Z.export = function (kind) {
    if (!state.haz.length) return M.ui.toast('Nothing to export yet');
    if (kind === 'json') U.download(`marex-hazards-${stamp()}.json`, JSON.stringify(state.haz, null, 2));
    else if (kind === 'geojson') U.download(`marex-hazards-${stamp()}.geojson`, JSON.stringify(toGeoJSON(state.haz), null, 2), 'application/geo+json');
    else if (kind === 'csv') {
      const head = ['id', 'lat', 'lon', 'category', 'risk', 'confidence', 'description', 'source', 'date'];
      const rows = state.haz.map((h) => [h.id, h.ll[0], h.ll[1], catOf(h.cat)[1], h.risk, h.conf, h.desc, h.src, h.date].map(U.csvCell).join(','));
      U.download(`marex-hazards-${stamp()}.csv`, '\uFEFF' + [head.join(',')].concat(rows).join('\r\n'), 'text/csv;charset=utf-8'); // BOM so Excel reads UTF-8
    }
    M.ui.toast('Export ready', { type: 'ok' });
  };

  Z.import = async function (file) {
    try {
      const data = JSON.parse(await file.text());
      let items = [];
      if (Array.isArray(data)) items = data;
      else if (data && Array.isArray(data.features)) {
        items = data.features.filter((f) => f && f.geometry && f.geometry.type === 'Point' && Array.isArray(f.geometry.coordinates))
          .map((f) => {
            const p = f.properties || {};
            return { ll: [+f.geometry.coordinates[1], +f.geometry.coordinates[0]], cat: p.category, risk: p.risk, conf: p.confidence, desc: p.description, src: p.source, date: p.date };
          });
      } else throw new Error('format');
      if (items.length > 5000) throw new Error('too many');
      const good = items.filter((x) => x && U.valid(x.ll));
      if (!good.length) throw new Error('empty');
      const added = [];
      let id = nextId();
      good.forEach((x) => { added.push(id); state.haz.push(sanitize(x, id++)); });
      Z.commit();
      const skipped = items.length - good.length;
      M.ui.toast(`Imported ${good.length} marker${good.length > 1 ? 's' : ''}${skipped ? `, skipped ${skipped} invalid` : ''}`, {
        type: 'ok', action: { label: 'Undo', fn: () => { state.haz = state.haz.filter((x) => !added.includes(x.id)); Z.commit(); } }
      });
    } catch {
      M.ui.toast('That file is not a MAREX hazard export (JSON or GeoJSON points).', { type: 'error' });
    }
  };

  /* ---------- Map drawing ---------- */
  Z.draw = function () {
    M.G.haz.clearLayers();
    Z.visible().forEach((h) => {
      const col = catOf(h.cat)[2];
      L.marker(h.ll, { icon: M.pinIcon(col, 18, 'hz', CFG.riskColors[h.risk]), draggable: true, keyboard: true, alt: `Hazard ${h.id}` })
        .addTo(M.G.haz)
        .bindTooltip(`#${h.id} · ${catOf(h.cat)[1]} · ${h.risk}`, { direction: 'top', offset: [0, -10] })
        .on('click', (e) => { L.DomEvent.stop(e); M.inspect.haz(h); })
        .on('dragend', (e) => { const p = e.target.getLatLng(); h.ll = [p.lat, p.lng]; Z.commit(); M.inspect.haz(h); });
      L.polygon(U.circlePoly(h.ll, CFG.hazardRadiusKm), { color: col, weight: 1, fillOpacity: 0.07, interactive: false }).addTo(M.G.haz);
    });
  };

  Z.fitAll = function () {
    const v = Z.visible();
    if (!v.length) return M.ui.toast('No markers to show');
    M.fitTo(L.latLngBounds(v.map((h) => h.ll)).pad(0.3), 11);
  };

  /* ---------- Panel ---------- */
  Z.init = function () {
    loadStored();
    $('#haz').innerHTML = `
      <h4>Survey log</h4>
      <button class="btn primary block" id="addh" aria-pressed="false">＋ Place marker on map <kbd>H</kbd></button>
      <div class="note">Markers are your own annotations. Risk levels are preliminary visual judgements, never verified predictions of danger.</div>
      <div class="btn-row">
        <button class="btn sm" data-io="json">⤓ JSON</button>
        <button class="btn sm" data-io="csv">⤓ CSV</button>
        <button class="btn sm" data-io="geojson">⤓ GeoJSON</button>
        <button class="btn sm" data-io="fit" title="Zoom to the markers">⌖ Fit all</button>
        <button class="btn sm" data-io="import">⤒ Import</button>
        <button class="btn sm danger" data-io="clear">Clear all</button>
      </div>
      <input type="file" id="fi" accept=".json,.geojson,application/json" hidden>
      <div class="btn-row tight">
        <input class="field grow" id="hazQ" type="search" placeholder="Filter markers…" aria-label="Filter markers">
        <select class="field" id="hazSort" aria-label="Sort markers">
          <option value="new">Newest</option><option value="risk">Risk</option><option value="cat">Category</option>
        </select>
      </div>
      <div id="hazDyn"></div>`;

    $('#addh').onclick = () => M.mode.toggle('haz');
    $('#haz').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.io === 'fit') Z.fitAll();
      else if (b.dataset.io === 'import') $('#fi').click();
      else if (b.dataset.io === 'clear') Z.clearAll();
      else if (b.dataset.io) Z.export(b.dataset.io);
      else if (b.dataset.risk) { state.filt.risk = state.filt.risk === b.dataset.risk ? null : b.dataset.risk; Z.draw(); Z.render(); }
      else if (b.dataset.cat) { state.filt.cat = state.filt.cat === b.dataset.cat ? null : b.dataset.cat; Z.draw(); Z.render(); }
      else if (b.dataset.reset) { state.filt = { cat: null, risk: null, q: '' }; $('#hazQ').value = ''; Z.draw(); Z.render(); }
      else if (b.dataset.h) {
        const h = state.haz.find((x) => x.id === +b.dataset.h);
        if (h) { M.goTo(h.ll, Math.max(M.map.getZoom(), 10)); M.inspect.haz(h); }
      }
    });
    $('#fi').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) Z.import(f); };
    $('#hazQ').addEventListener('input', U.debounce((e) => { state.filt.q = e.target.value.trim(); Z.draw(); Z.render(); }, 150));
    $('#hazSort').onchange = (e) => { state.sort = e.target.value; Z.render(); };
    M.on('mode', ({ mode }) => { $('#addh').setAttribute('aria-pressed', String(mode === 'haz')); });

    Z.draw(); Z.render();
  };

  Z.render = function () {
    const dyn = $('#hazDyn');
    if (!dyn) return;
    const all = state.haz, list = Z.visible().slice();
    if (state.sort === 'risk') list.sort((a, b) => RANK[a.risk] - RANK[b.risk] || b.id - a.id);
    else if (state.sort === 'cat') list.sort((a, b) => catOf(a.cat)[1].localeCompare(catOf(b.cat)[1]) || b.id - a.id);
    else list.sort((a, b) => b.id - a.id);

    const count = (r) => all.filter((h) => h.risk === r).length;
    const filtered = state.filt.cat || state.filt.risk || state.filt.q;

    let h = `<div class="stats" role="group" aria-label="Filter by risk">` +
      CFG.risks.map((r) => `<button class="stat ${state.filt.risk === r ? 'on' : ''}" data-risk="${r}" style="--c:${CFG.riskColors[r]}"><b>${count(r)}</b><span>${r}</span></button>`).join('') + `</div>`;
    h += `<h4>Category</h4><div class="chips">` +
      CFG.cats.map((c) => `<button class="chip ${state.filt.cat === c[0] ? 'on' : ''}" data-cat="${c[0]}"><i style="background:${c[2]}"></i>${esc(c[1])}</button>`).join('') + `</div>`;
    h += `<h4>Markers <span class="count">${list.length}${filtered ? ' / ' + all.length : ''}</span></h4>`;

    if (list.length) {
      h += list.map((x) => `
        <button class="item" data-h="${x.id}">
          <span class="tag" style="color:${CFG.riskColors[x.risk]}">${x.risk}</span>
          <b>#${x.id} ${esc(catOf(x.cat)[1])}</b>
          <small>${U.fmt(x.ll)}${x.desc ? ' · ' + esc(x.desc.slice(0, 40)) : ''}</small>
        </button>`).join('');
    } else if (filtered) {
      h += `<p class="k">No markers match the filters.</p><button class="btn sm" data-reset="1">Clear filters</button>`;
    } else {
      h += `<div class="empty"><b>No markers yet</b><p>Press <kbd>H</kbd> and click the map to start your survey log.</p></div>`;
    }
    dyn.innerHTML = h;
  };

  M.on('fmt', Z.render);
})(window.MAREX);
