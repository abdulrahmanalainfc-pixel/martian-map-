/* =====================================================================
   search.js — header search box with a keyboard-navigable suggestion list.
   Finds sites, candidates, bookmarks, hazards, regions and coordinates.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state } = M;
  const { $, esc } = U;
  const S = (M.search = {});

  let items = [], active = -1, lastQ = '';

  function candidates(q) {
    const t = q.toLowerCase();
    const out = [];
    const coords = q ? U.parseCoords(q) : null;
    if (coords) {
      out.push(coords.error
        ? { label: 'Invalid coordinates', sub: coords.error, kind: 'error' }
        : { label: 'Go to ' + U.fmt(coords.ll), sub: 'Coordinates', kind: 'coord', ll: coords.ll });
    }
    const add = (kind, label, sub, ll, ref) => out.push({ kind, label, sub, ll, ref });
    CFG.sites.forEach((s) => { if (!t || s.n.toLowerCase().includes(t)) add('site', s.n, s.kind, s.ll, s); });
    CFG.cands.forEach((c) => { if (!t || c.n.toLowerCase().includes(t)) add('cand', c.n, 'Demo candidate', c.ll, c); });
    state.bookmarks.forEach((b) => { if (!t || b.n.toLowerCase().includes(t)) add('bm', '★ ' + b.n, 'Bookmark', b.ll, b.id); });
    state.haz.forEach((h) => {
      const cat = M.hazards.catOf(h.cat)[1];
      if (t && !(`#${h.id} ${cat} ${h.desc}`).toLowerCase().includes(t)) return;
      add('haz', `#${h.id} ${cat}`, 'Hazard · ' + h.risk, h.ll, h);
    });
    CFG.regions.forEach((r) => { if (!t || r.name.toLowerCase().includes(t)) add('region', r.name, 'Region', r.c, r); });
    return out.slice(0, 9);
  }

  function open(list) {
    items = list; lastQ = $('#q').value.trim(); active = list.length && list[0].kind !== 'error' ? 0 : -1;
    const box = $('#sugg'), inp = $('#q');
    if (!list.length) { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
    box.innerHTML = list.map((it, i) => `
      <div class="sg ${it.kind === 'error' ? 'err' : ''} ${i === active ? 'on' : ''}" role="option" id="sg${i}" data-i="${i}" aria-selected="${i === active}">
        <b>${esc(it.label)}</b><small>${esc(it.sub)}</small>
      </div>`).join('');
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
  }
  const close = () => { $('#sugg').hidden = true; $('#q').setAttribute('aria-expanded', 'false'); active = -1; };

  function mark(i) {
    active = i;
    document.querySelectorAll('#sugg .sg').forEach((el, k) => { el.classList.toggle('on', k === i); el.setAttribute('aria-selected', String(k === i)); });
    const el = $('#sg' + i);
    if (el) { el.scrollIntoView({ block: 'nearest' }); $('#q').setAttribute('aria-activedescendant', 'sg' + i); }
  }

  function choose(it) {
    if (!it || it.kind === 'error') return;
    close();
    $('#q').blur();
    if (it.kind === 'coord') { M.goTo(it.ll, 11); M.inspect.point(it.ll); }
    else if (it.kind === 'region') M.setRegion(it.ref.id);
    else {
      M.goTo(it.ll, it.kind === 'haz' ? Math.max(M.map.getZoom(), 10) : 11);
      if (it.kind === 'site') M.inspect.site(it.ref);
      else if (it.kind === 'cand') M.inspect.cand(it.ref);
      else if (it.kind === 'bm') M.inspect.bookmark(it.ref);
      else if (it.kind === 'haz') M.inspect.haz(it.ref);
    }
  }

  S.init = function () {
    const inp = $('#q'), box = $('#sugg');
    inp.addEventListener('focus', () => open(candidates(inp.value.trim())));
    inp.addEventListener('input', U.debounce(() => open(candidates(inp.value.trim())), 80));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (box.hidden) open(candidates(inp.value.trim())); else if (items.length) mark((active + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) mark((active - 1 + items.length) % items.length); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const fresh = inp.value.trim() !== lastQ; // typed < 80 ms ago: the suggestion list is stale
        const list = fresh ? candidates(inp.value.trim()) : items;
        const it = fresh || active < 0 ? list.find((x) => x.kind !== 'error') || list[0] : list[active];
        if (it && it.kind !== 'error') choose(it);
        else M.ui.toast(it ? it.sub : 'Not found. Try "18.44, 77.45" or a site name.', { type: 'error' });
      } else if (e.key === 'Escape') { e.stopPropagation(); close(); inp.blur(); }
    });
    box.addEventListener('mousedown', (e) => {          // mousedown so the input doesn't blur first
      const el = e.target.closest('.sg');
      if (el) { e.preventDefault(); choose(items[+el.dataset.i]); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) close(); });
  };
})(window.MAREX);
