/* =====================================================================
   tiles.js — imagery layers with several sources.
   Every layer in CFG.base / CFG.overlays can be served by up to four
   sources, tried in this order. If the current one loads nothing
   (CFG.failoverAfter failed tiles, none loaded) the layer switches to
   the next one by itself:
     trek  NASA Mars Trek WMTS          (CFG.trek)
     api   same tilesets on api.nasa.gov (CFG.apiWmts)
     wms   USGS Astrogeology WMS         (only if the layer has `wms`)
     esri  Esri / Murray Lab CTX mosaic  (only if the layer has `esri`)
   A tile that fails in its first file type is retried once with `alt`
   (e.g. png -> jpg) before it counts as a failure.
   Per-layer health lives in M.TS[id] = { ok, bad, src }.
   ===================================================================== */
(function (M) {
  'use strict';
  if (!window.L) return; // mapview.js shows the friendly error
  const { CFG } = M;
  const TS = (M.TS = {});
  const WORLD = [[-90, -180], [90, 180]];

  const SRC = {
    trek: { name: 'NASA Trek',     attr: 'NASA/JPL/USGS via NASA Trek' },
    api:  { name: 'api.nasa.gov',  attr: 'NASA/JPL/USGS via api.nasa.gov' },
    wms:  { name: 'USGS WMS',      attr: 'USGS Astrogeology' },
    esri: { name: 'Esri CTX',      attr: 'CTX: NASA/JPL/MSSS · Esri / Murray Lab' }
  };
  const sourcesOf = (c) =>
    ['trek', 'api'].concat(c.wms ? ['wms'] : [], c.esri ? ['esri'] : []).map((k) => ({ k, n: SRC[k].name }));

  /* ---------- Tile layer that retries a failed tile once with the alternate file type ---------- */
  const AltTile = L.TileLayer.extend({
    createTile(coords, done) {
      const alt = this.options.altExt;
      let retried = false;
      return L.TileLayer.prototype.createTile.call(this, coords, (err, tile) => {
        if (err && alt && !retried) {
          retried = true;
          tile.src = this.getTileUrl(coords).replace(/\.[a-z0-9]+$/i, '.' + alt); // Leaflet's load/error listeners stay attached
          return;
        }
        done(err, tile);
      });
    }
  });

  /* ---------- Esri ArcGIS "export" endpoint as a tile layer (bbox in Mars 2000, EPSG:104971) ---------- */
  const EsriTile = L.TileLayer.extend({
    getTileUrl(co) {
      const b = this._tileCoordsToBounds(co);
      return `${this.options.esriUrl}/export?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',')}` +
        '&bboxSR=104971&imageSR=104971&size=256,256&format=jpg&f=image';
    }
  });

  function make(c, s, opacity, z) {
    const o = { maxZoom: CFG.maxZoom, opacity, noWrap: true, bounds: c.bounds || WORLD, zIndex: z, attribution: SRC[s.k].attr };
    if (s.k === 'wms') return L.tileLayer.wms(CFG.usgsWms, Object.assign({ layers: c.wms, version: '1.1.1', format: 'image/jpeg' }, o));
    if (s.k === 'esri') return new EsriTile('', Object.assign({ esriUrl: c.esri }, o));
    const root = s.k === 'trek' ? CFG.trek : CFG.apiWmts;
    return new AltTile(`${root}${c.set}/1.0.0/default/default028mm/{z}/{y}/{x}.${c.ext}`, Object.assign({ maxNativeZoom: c.native, altExt: c.alt }, o));
  }

  /* ---------- A layer that owns one tile layer at a time and swaps it on failure ---------- */
  const Multi = L.LayerGroup.extend({
    initialize(c, id, z) {
      L.LayerGroup.prototype.initialize.call(this, []);
      this.options = { opacity: c.opacity ?? 1 };
      this._c = c; this._id = id; this._z = z;
      this._S = sourcesOf(c);
      this._i = 0;
      this._cur = null;
      TS[id] = { ok: 0, bad: 0, src: this._S[0].n };
    },

    onAdd(map) {
      L.LayerGroup.prototype.onAdd.call(this, map);
      if (!this._cur) this._use(0); // first time on the map; later adds reuse the current source
    },

    getOpacity() { return this.options.opacity; },
    setOpacity(o) {
      this.options.opacity = o;
      if (this._cur) this._cur.setOpacity(o);
      return this;
    },

    _use(n) {
      if (this._cur) this.removeLayer(this._cur);
      const s = this._S[n], id = this._id, layer = make(this._c, s, this.options.opacity, this._z);
      this._i = n;
      this._cur = layer;
      Object.assign(TS[id], { ok: 0, bad: 0, src: s.n });
      layer
        .on('tileload', () => { if (layer === this._cur) { TS[id].ok++; M.emit('status'); } })
        .on('tileerror', () => {
          if (layer !== this._cur) return; // late event from a source we already left
          const t = TS[id];
          t.bad++;
          if (!t.ok && t.bad >= CFG.failoverAfter && this._i < this._S.length - 1) {
            setTimeout(() => { if (layer === this._cur) this._use(this._i + 1); }, 0);
          }
          M.emit('status');
        });
      this.addLayer(layer);
    }
  });

  M.tiles = {
    // z = stacking order inside the tile pane: backdrop 1 < other base 2 < overlays 3+
    create: (c, id = c.id, z = 1) => new Multi(c, id, z)
  };
})(window.MAREX);
