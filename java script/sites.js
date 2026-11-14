/* =====================================================================
   sites.js — "Sites" tab: sites of interest, demo candidates, bookmarks.
   Bookmarks are addressed by stable id (never by list index).
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state, STATUS } = M;
  const { $, esc } = U;
  const S = (M.sites = {});

  const starIcon = () => L.divIcon({ className: '', iconSize: [20, 20], html: '<div class="star">★</div>' });
  S.get = (id) => state.bookmarks.find((b) => b.id === id);
  const nextId = () => state.bookmarks.reduce((m, b) => Math.max(m, b.id), 0) + 1;

  S.init = function () {
    CFG.sites.forEach((s) => {
      L.marker(s.ll, { icon: M.pinIcon(s.st === 'verified' ? '#4fd1a5' : '#ffb347'), alt: s.n })
        .addTo(M.G.sites)
        .bindTooltip(esc(s.n), { direction: 'top', offset: [0, -8] })
        .on('click', (e) => { L.DomEvent.stop(e); M.inspect.site(s); });
    });
    CFG.cands.forEach((c) => {
      // geodesic circle: a degree-radius L.circle is squashed east-west by cos(latitude)
      L.polygon(U.circlePoly(c.ll, c.r), { color: '#a78bfa', dashArray: '5 5', weight: 2, fillOpacity: 0.15 })
        .addTo(M.G.cands)
        .bindTooltip(esc(c.n) + ' (demo)', { sticky: true })
        .on('click', (e) => { L.DomEvent.stop(e); M.inspect.cand(c); });
    });
    S.drawBookmarks();

    $('#siteFilter').addEventListener('input', U.debounce(S.render, 120));
    $('#sitList').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.gj) M.setRegion('jez');
      else if (d.site !== undefined) { const s = CFG.sites[+d.site]; M.goTo(s.ll, 10); M.inspect.site(s); }
      else if (d.cand !== undefined) { const c = CFG.cands[+d.cand]; M.goTo(c.ll, 10); M.inspect.cand(c); }
      else if (d.bm !== undefined) { const bm = S.get(+d.bm); if (bm) { M.goTo(bm.ll, 10); M.inspect.bookmark(bm.id); } }
      else if (d.bmr !== undefined) S.rename(+d.bmr);
      else if (d.bmx !== undefined) S.removeBookmark(+d.bmx);
    });
    S.render();
  };

  /* ---------- Bookmarks ---------- */
  const persist = () => { U.store.set('bm', state.bookmarks); S.drawBookmarks(); S.render(); };

  S.drawBookmarks = function () {
    M.G.bm.clearLayers();
    state.bookmarks.forEach((b) => {
      L.marker(b.ll, { icon: starIcon(), alt: b.n })
        .addTo(M.G.bm)
        .bindTooltip(esc(b.n), { direction: 'top', offset: [0, -8] }) // names are user text: escape before Leaflet's innerHTML
        .on('click', (e) => { L.DomEvent.stop(e); M.inspect.bookmark(b.id); });
    });
  };

  S.addBookmark = function (ll) {
    const id = nextId();
    state.bookmarks.push({ id, n: 'Bookmark ' + id, ll: [ll[0], ll[1]] });
    persist();
    M.ui.toast('Location bookmarked', { type: 'ok' });
    M.inspect.bookmark(id);
  };

  S.rename = async function (id) {
    const b = S.get(id);
    if (!b) return;
    const v = await M.ui.ask({ title: 'Rename bookmark', label: 'Name', value: b.n });
    if (v) { b.n = v.slice(0, 60); persist(); M.inspect.bookmark(id); }
  };

  S.removeBookmark = function (id) {
    const b = S.get(id);
    if (!b) return;
    const snapshot = U.clone(state.bookmarks);
    state.bookmarks = state.bookmarks.filter((x) => x.id !== id);
    persist();
    M.inspect.dropIf('bm:' + id);
    M.ui.toast(`Removed "${b.n}"`, { action: { label: 'Undo', fn: () => { state.bookmarks = snapshot; persist(); } } });
  };

  /* ---------- Rendering ---------- */
  S.render = function () {
    const q = (($('#siteFilter') || {}).value || '').trim().toLowerCase();
    const hit = (s) => !q || s.n.toLowerCase().includes(q) || (s.kind || '').toLowerCase().includes(q);
    const sites = CFG.sites.map((s, i) => [s, i]).filter(([s]) => hit(s));
    const cands = CFG.cands.map((s, i) => [s, i]).filter(([s]) => hit(s));
    const bms = state.bookmarks.filter(hit);

    const here = M.areaId();
    sites.sort((a, b) => (b[0].reg === here) - (a[0].reg === here)); // sites in the area you are viewing come first
    let h = (M.hasSites() ? '' : '<div class="note">No curated sites are mapped for the area you are viewing (Jezero, Gale and Olympus Mons have them). Bookmarks, hazards and routes work anywhere. <button class="btn sm" data-gj="1">Go to Jezero</button></div>') +
      `<h4>Sites of interest <span class="count">${sites.length}</span></h4>`;
    h += sites.length ? sites.map(([s, i]) => `
      <button class="item" data-site="${i}">
        <span class="tag ${STATUS[s.st][1]}">${STATUS[s.st][0]}</span>
        <b>${esc(s.n)}</b>
        <small>${U.fmt(s.ll)} · ${esc(s.kind)}</small>
      </button>`).join('') : '<p class="k">No site matches.</p>';

    h += `<h4>Subsurface candidates <span class="count">${cands.length}</span> <span class="tag sim">Demo</span></h4>
          <div class="note">Placeholders to show how the layer works. Not real detections, not mapped caves.</div>`;
    h += cands.map(([c, i]) => `
      <button class="item" data-cand="${i}"><b>${esc(c.n)}</b><small>${U.fmt(c.ll)} · r ${c.r} km</small></button>`).join('');

    h += `<h4>Bookmarks <span class="count">${bms.length}</span></h4>`;
    h += bms.length ? bms.map((b) => `
      <div class="item-row">
        <button class="item" data-bm="${b.id}"><b>★ ${esc(b.n)}</b><small>${U.fmt(b.ll)}</small></button>
        <button class="icon-btn" data-bmr="${b.id}" aria-label="Rename ${esc(b.n)}" title="Rename">✎</button>
        <button class="icon-btn danger" data-bmx="${b.id}" aria-label="Remove ${esc(b.n)}" title="Remove">✕</button>
      </div>`).join('') : '<p class="k">Click the map, then press “Bookmark” in the inspector.</p>';

    $('#sitList').innerHTML = h;
  };

  M.on('fmt', S.render);
  M.on('avail', S.render);
})(window.MAREX);
