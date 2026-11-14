/* =====================================================================
   mapview.js — Leaflet map, Mars CRS, imagery layers (multi-source, see
   tiles.js), minimap, graticule, annotation groups, region switching,
   shareable links.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U } = M;

  if (!window.L) {
    const el = document.getElementById('map');
    if (el) el.innerHTML = '<div class="fatal"><b>The map library failed to load.</b><br>Check your internet connection and reload the page.</div>';
    return;
  }

  const WORLD = [[-90, -180], [90, 180]];
  const boundsFor = (r) => L.latLngBounds(r.b).pad(0.2);
  // First region whose (padded) box contains the point. The last region covers the whole planet, so this always finds one.
  const regionAt = (ll) => CFG.regions.find((r) => boundsFor(r).contains(ll)) || CFG.regions[CFG.regions.length - 1];
  const minZ = (r) => (r && r.mz != null ? r.mz : CFG.minZoom);
  const clampZ = (z) => { const n = Math.round(+z); return isFinite(n) ? Math.min(CFG.maxZoom, Math.max(CFG.minZoom, n)) : 8; };
  const normLon = (ll) => [+ll[0], +ll[1] > 180 ? +ll[1] - 360 : +ll[1]];

  /* ---------- Start view: link (#c=lat,lon&z=..&b=..) > last session > region default ---------- */
  function readHash() {
    const o = {};
    try { new URLSearchParams(location.hash.replace(/^#/, '')).forEach((v, k) => { o[k] = v; }); } catch { /* ignore */ }
    const p = o.c ? o.c.split(',').map(Number) : null;
    if (p && p.length === 2 && U.valid(p)) o.ll = p;
    o.z = +o.z;
    return o;
  }
  const hv = readHash();
  const saved = U.store.get('view', null);
  const pick = hv.ll ? { ll: hv.ll, z: hv.z } : saved && U.valid(saved.c) ? { ll: saved.c, z: saved.z } : null;

  let REG = CFG.regions[0];
  let start = REG.c, startZ = REG.z;
  if (pick) {
    start = normLon(pick.ll);
    startZ = clampZ(pick.z);
    REG = regionAt(start);
  } else if (saved) {
    const r = CFG.regions.find((x) => x.id === saved.region);
    if (r) { REG = r; start = r.c; startZ = r.z; }
  }

  /* ---------- Map with a Mars CRS (Leaflet's scale bar assumes Earth otherwise) ---------- */
  const MarsCRS = L.extend({}, L.CRS.EPSG4326, {
    distance: (a, b) => U.hav([a.lat, a.lng], [b.lat, b.lng]) * 1000
  });
  const map = L.map('map', {
    crs: MarsCRS, center: start, zoom: startZ, minZoom: minZ(REG), maxZoom: CFG.maxZoom,
    maxBounds: WORLD, maxBoundsViscosity: 1, attributionControl: true
  });
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  /* ---------- Tile layers (multi-source, see tiles.js) ---------- */
  // Stacking: Viking backdrop (1) is always on; the chosen base sits above it (2) so small-area
  // layers (CTX, HiRISE) show the backdrop around their edges; overlays draw above everything (3+).
  const TS = M.TS;
  const baseL = {}, ovL = {};
  CFG.base.forEach((c) => (baseL[c.id] = M.tiles.create(c, c.id, c.id === 'vis' ? 1 : 2)));
  CFG.overlays.forEach((c, i) => (ovL[c.id] = M.tiles.create(c, c.id, 3 + i)));
  baseL.vis.addTo(map);

  /* ---------- Minimap (always the Viking mosaic, no WMS backup) ---------- */
  const mini = L.map('mini', {
    crs: MarsCRS, center: start, zoom: 1, zoomControl: false, attributionControl: false,
    dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false
  });
  M.tiles.create(Object.assign({}, CFG.base[0], { wms: null }), '_mini').addTo(mini);
  mini.on('click', (e) => map.setView(e.latlng));
  const vr = L.rectangle(map.getBounds(), { color: '#ff7a45', weight: 1.5, fill: false, interactive: false }).addTo(mini);
  const miniZoom = () => Math.max(1, Math.min(7, map.getZoom() - 4)); // follows the main map, so the box stays visible
  const syncMini = () => mini.setView(map.getCenter(), miniZoom(), { animate: false });
  map.on('move zoomend', () => vr.setBounds(map.getBounds()));
  map.on('moveend zoomend', syncMini);
  syncMini();

  // Keep both maps correct whenever their container changes size (panels, rotation, fullscreen).
  const host = document.getElementById('M');
  if (host && window.ResizeObserver) {
    new ResizeObserver(U.debounce(() => { map.invalidateSize(); mini.invalidateSize(); }, 60)).observe(host);
  }

  /* ---------- Graticule (lat/lon grid), redrawn on demand ---------- */
  const grat = L.layerGroup();
  const STEPS = [0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30];
  function drawGrat() {
    grat.clearLayers();
    const b = map.getBounds().pad(0.05);
    const s = b.getSouth(), n = b.getNorth(), w = b.getWest(), e = b.getEast();
    const step = STEPS.find((x) => Math.max(e - w, n - s) / x <= 8) || 30;
    const line = { color: '#ffffff', weight: 1, opacity: 0.4, dashArray: '2 6', interactive: false };
    const lab = (ll, text, cls) => L.marker(ll, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'grat-lab ' + cls, html: text, iconSize: [0, 0] }) }).addTo(grat);
    let guard = 0;
    for (let i = Math.ceil(s / step); i * step <= n && guard++ < 40; i++) {
      const v = +(i * step).toFixed(4);
      L.polyline([[v, w], [v, e]], line).addTo(grat);
      lab([v, w], `${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}`, 'lat');
    }
    guard = 0;
    for (let i = Math.ceil(w / step); i * step <= e && guard++ < 40; i++) {
      const v = +(i * step).toFixed(4);
      L.polyline([[s, v], [n, v]], line).addTo(grat);
      lab([n, v], `${Math.abs(v)}°${v >= 0 ? 'E' : 'W'}`, 'lon');
    }
  }
  grat.on('add', drawGrat);
  map.on('moveend zoomend', () => { if (map.hasLayer(grat)) drawGrat(); });

  /* ---------- Annotation groups ---------- */
  const G = {
    sites: L.layerGroup().addTo(map), bm: L.layerGroup().addTo(map), cands: L.layerGroup(),
    haz: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map),
    measure: L.layerGroup().addTo(map), pick: L.layerGroup().addTo(map), grat
  };

  M.pinIcon = (color, size = 16, cls = '', ring) =>
    L.divIcon({
      className: '', iconSize: [size, size],
      html: `<div class="pin ${cls}" style="background:${color};${ring ? `box-shadow:0 0 0 3px ${ring};` : ''}"></div>`
    });

  /* ---------- What is available where (Jezero-only layers, latitude limits, curated sites) ---------- */
  const JB = L.latLngBounds(CFG.regions[0].b).pad(0.1);
  M.atJez = () => JB.contains(map.getCenter());
  M.why = (c) => (c.only === 'jez' && !M.atJez() ? 'Jezero only' : c.lat && Math.abs(map.getCenter().lat) > c.lat ? `covers ${c.lat}°N–${c.lat}°S only` : '');
  M.areaId = () => { const c = map.getCenter(), r = CFG.regions.find((x) => x.id !== 'mars' && L.latLngBounds(x.b).pad(0.1).contains(c)); return r ? r.id : null; };
  M.hasSites = () => { const a = M.areaId(); return !!a && CFG.sites.some((s) => s.reg === a); };
  const avNow = () => CFG.base.concat(CFG.overlays).map(M.why).join('|') + '|' + M.areaId();
  let avKey = avNow();
  map.on('moveend', () => { const k = avNow(); if (k !== avKey) { avKey = k; M.emit('avail'); } });
  // Leaving Jezero with a Jezero-only base selected: fall back to Viking colour and say so.
  function dropJezOnly(ll) {
    const b = CFG.base.find((c) => c.id === M.state.curBase);
    if (b && b.only && !JB.contains(ll) && M.layersPanel) {
      M.layersPanel.setBase('vis');
      if (M.ui) M.ui.banner(`${b.name} only covers Jezero, so the map went back to Viking colour.`, 6000);
    }
  }

  /* ---------- Navigation helpers ---------- */
  const syncRegionSelect = () => { const sel = U.$('#reg'); if (sel) sel.value = REG.id; };

  // Make `rg` the current region (its minimum zoom + the region picker). Returns true if it changed.
  function enter(rg) {
    if (!rg || rg === REG) return false;
    REG = rg;
    map.setMinZoom(minZ(rg));
    syncRegionSelect();
    return true;
  }

  M.setRegion = (id) => {
    const r = CFG.regions.find((x) => x.id === id);
    if (!r) return;
    REG = null; enter(r);              // force the min-zoom + picker refresh even for the same region
    map.setView(r.c, r.z);
    dropJezOnly(r.c);
    if (r.id !== 'jez' && M.ui && M.state.curBase === 'vis') M.ui.banner('CTX and HiRISE layers and demo candidates exist for Jezero only. Terrain numbers need an elevation file you load yourself (Layers tab).', 6000);
    M.emit('region', r);
  };

  // Go anywhere. The imagery is global, so the map is never fenced to a region; the region picker just follows.
  M.goTo = (ll, z = 11) => {
    ll = normLon(ll);
    enter(regionAt(ll));
    map.setView(ll, clampZ(z));
    dropJezOnly(ll);
  };

  // Fit a set of points / bounds (routes, hazard sets).
  M.fitTo = (b, maxZoom = 12) => {
    map.fitBounds(L.latLngBounds(b), { animate: false, maxZoom: Math.min(maxZoom, CFG.maxZoom) });
    enter(regionAt(map.getCenter()));
    const c = map.getCenter(); dropJezOnly([c.lat, c.lng]);
  };

  M.region = () => REG;

  /* ---------- Persistence + shareable link ---------- */
  M.permalink = () => {
    const c = map.getCenter();
    return `${location.href.split('#')[0]}#c=${c.lat.toFixed(5)},${c.lng.toFixed(5)}&z=${map.getZoom()}&b=${M.state.curBase}`;
  };
  M.syncHash = U.debounce(() => { try { history.replaceState(null, '', M.permalink()); } catch { /* file:// or sandbox */ } }, 500);

  map.on('moveend', U.debounce(() => {
    const c = map.getCenter();
    U.store.set('view', { region: REG.id, c: [c.lat, c.lng], z: map.getZoom() });
    M.syncHash();
  }, 400));

  Object.assign(M, { map, mini, TS, baseL, ovL, G, WORLD, startHash: hv });
})(window.MAREX);
