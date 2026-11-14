/* =====================================================================
   terrain.js: numerical terrain. Loads a Mars 2020 CTX DEM (GeoTIFF) in the
   browser, derives slope and roughness, shows them on the map and in the
   inspector, and compares three A* route options (shortest / lowest risk /
   balanced). All weights live in CFG and are illustrative, not validated.
   ===================================================================== */
(function (M) {
  'use strict';
  const { CFG, U, state } = M;
  const { $, esc, hav, segDist, rad } = U;
  const T = (M.terrain = {});

  // Route options use the first and last point of the working route as A and B.
  const rt = {
    get a() {
      const p = state.rt.p;
      return p.length > 1 ? p[0] : null;
    },
    get b() {
      const p = state.rt.p;
      return p.length > 1 ? p[p.length - 1] : null;
    },
  };

  let DEM = null,
    dmode = 'slope',
    demLayer = null,
    lastCmp = '';
  function parseTiff(buf) {
    const dv = new DataView(buf),
      le = dv.getUint16(0) == 0x4949,
      u16 = (o) => dv.getUint16(o, le),
      u32 = (o) => dv.getUint32(o, le);
    if (buf.byteLength < 16) throw 'This file is too small to be a GeoTIFF.';
    const b0 = new Uint8Array(buf, 0, 2);
    if (!((b0[0] == 73 && b0[1] == 73) || (b0[0] == 77 && b0[1] == 77))) throw 'This is not a TIFF file. Choose the .tif elevation file.';
    if (u16(2) == 43) throw 'This is a BigTIFF. Re-save it as a classic GeoTIFF.';
    if (u16(2) != 42) throw 'This is not a TIFF file. Choose the .tif elevation file.';
    const ifd = u32(4),
      n = u16(ifd),
      T = {};
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12,
        tag = u16(e),
        ty = u16(e + 2),
        c = u32(e + 4),
        sz = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8 }[ty] || 1,
        o = sz * c <= 4 ? e + 8 : u32(e + 8);
      T[tag] =
        ty == 2
          ? String.fromCharCode(...new Uint8Array(buf, o, c))
          : Array.from({ length: c }, (_, k) =>
              ty == 3
                ? u16(o + 2 * k)
                : ty == 4
                  ? u32(o + 4 * k)
                  : ty == 12
                    ? dv.getFloat64(o + 8 * k, le)
                    : dv.getUint8(o + k),
            );
    }
    if (!T[256] || !T[257] || !T[258]) throw 'The file is missing basic image information (width, height or bit depth).';
    if ((T[277] || [1])[0] != 1) throw 'Expected a single-band elevation file.';
    const W = T[256][0],
      Hh = T[257][0];
    if (!(W > 0 && Hh > 0) || W * Hh > 2.5e8) throw 'The image size is not valid or is too large for this browser.';
    if ((T[259] || [1])[0] != 1)
      throw 'The file is compressed. Make an uncompressed copy: gdal_translate -co COMPRESS=NONE in.tif out.tif';
    if (T[258][0] != 32 || (T[339] || [1])[0] != 3) throw 'Expected 32-bit float elevation values.';
    const z = new Float32Array(W * Hh);
    if (T[324]) {
      const tw = T[322][0],
        th = T[323][0],
        tpr = Math.ceil(W / tw);
      T[324].forEach((off, t) => {
        const x0 = (t % tpr) * tw,
          y0 = Math.floor(t / tpr) * th;
        for (let y = 0; y < th && y0 + y < Hh; y++)
          for (let x = 0; x < tw && x0 + x < W; x++)
            z[(y0 + y) * W + x0 + x] = dv.getFloat32(off + 4 * (y * tw + x), le);
      });
    } else {
      const rps = (T[278] || [Hh])[0];
      T[273].forEach((off, s) => {
        for (let y = 0; y < rps && s * rps + y < Hh; y++)
          for (let x = 0; x < W; x++) z[(s * rps + y) * W + x] = dv.getFloat32(off + 4 * (y * W + x), le);
      });
    }
    const nd = T[42113] ? parseFloat(T[42113]) : null;
    let zmin = 1e9,
      zmax = -1e9;
    for (let i = 0; i < z.length; i++) {
      const v = z[i];
      if (!isFinite(v) || (nd !== null && v === nd) || v < -1e30 || v > 1e30) z[i] = NaN;
      else {
        if (v < zmin) zmin = v;
        if (v > zmax) zmax = v;
      }
    }
    let sx, sy, X, Y;
    if (T[33550] && T[33922]) {
      sx = T[33550][0];
      sy = T[33550][1];
      X = T[33922][3] - T[33922][0] * sx;
      Y = T[33922][4] + T[33922][1] * sy;
    } else if (T[34264]) {
      const m = T[34264];
      sx = m[0];
      sy = -m[5];
      X = m[3];
      Y = m[7];
    } else throw 'No georeferencing found in the file.';
    const deg = 180 / Math.PI,
      Rm = CFG.marsRadiusKm * 1000,
      metres = Math.abs(X) > 720 || sx > 1;
    let lon0 = metres ? (X / Rm) * deg : X;
    const lat0 = metres ? (Y / Rm) * deg : Y,
      dlon = metres ? (sx / Rm) * deg : sx,
      dlat = metres ? (sy / Rm) * deg : sy;
    if (lon0 + (W * dlon) / 2 > 180) lon0 -= 360; // files with 0–360 longitudes
    const d = {
      w: W,
      h: Hh,
      z,
      zmin,
      zmax,
      lon0,
      lat0,
      dlon,
      dlat,
      mx: dlon * rad(1) * Rm * Math.cos(rad(lat0 - (Hh * dlat) / 2)),
      my: dlat * rad(1) * Rm,
    };
    if (!(isFinite(lon0) && isFinite(lat0) && dlon > 0 && dlat > 0 && lat0 <= 90.5 && lat0 - Hh * dlat >= -90.5 && lon0 >= -180.5 && lon0 + W * dlon <= 180.5))
      throw (
        'The map position in this file does not make sense for Mars when read as an equirectangular map (corner ' +
        lat0.toFixed(2) +
        ', ' +
        lon0.toFixed(2) +
        '). Its projection is not supported, so MAREX refuses to place it.'
      );
    d.bounds = [
      [lat0 - Hh * dlat, lon0],
      [lat0, lon0 + W * dlon],
    ];
    return d;
  }
  const Z = (c, r) => (c < 0 || r < 0 || c >= DEM.w || r >= DEM.h ? NaN : DEM.z[r * DEM.w + c]);
  function slopeAt(c, r) {
    const a = Z(c - 1, r - 1),
      b = Z(c, r - 1),
      cc = Z(c + 1, r - 1),
      d = Z(c - 1, r),
      f = Z(c + 1, r),
      g = Z(c - 1, r + 1),
      h = Z(c, r + 1),
      i = Z(c + 1, r + 1);
    const dx = (cc + 2 * f + i - a - 2 * d - g) / (8 * DEM.mx),
      dy = (g + 2 * h + i - a - 2 * b - cc) / (8 * DEM.my);
    const v = (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI;
    return isFinite(v) ? v : NaN;
  }
  function roughAt(c, r) {
    let sz = 0,
      sdx = 0,
      sdy = 0,
      n = 0;
    const v = [];
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++) {
        const z = Z(c + x, r + y);
        if (isNaN(z)) return NaN;
        v.push([x, y, z]);
        sz += z;
        n++;
      }
    const m = sz / n;
    v.forEach(([x, y, z]) => {
      sdx += x * (z - m);
      sdy += y * (z - m);
    });
    const a = sdx / 50,
      b = sdy / 50;
    let e = 0;
    v.forEach(([x, y, z]) => {
      e += (z - m - a * x - b * y) ** 2;
    });
    return Math.sqrt(e / n);
  }
  function rampCol(t, st) {
    for (let i = 1; i < st.length; i++)
      if (t <= st[i][0] || i == st.length - 1) {
        const p = st[i - 1],
          q = st[i],
          u = Math.max(0, Math.min(1, (t - p[0]) / (q[0] - p[0] || 1))),
          A = hex(p[1]),
          B = hex(q[1]);
        return A.map((v, k) => v + (B[k] - v) * u);
      }
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function setDemMode(m) {
    dmode = m;
    if (demLayer) {
      M.map.removeLayer(demLayer);
      demLayer = null;
    }
    if (!DEM || m == 'off') return;
    const S = 2,
      cw = Math.floor(DEM.w / S),
      ch = Math.floor(DEM.h / S),
      cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const x = cv.getContext('2d'),
      im = x.createImageData(cw, ch);
    const el = [
      [DEM.zmin, '#1d2b64'],
      [DEM.zmin + (DEM.zmax - DEM.zmin) * 0.5, '#d9b38c'],
      [DEM.zmax, '#fff5e6'],
    ];
    for (let j = 0; j < ch; j++)
      for (let i = 0; i < cw; i++) {
        const c = i * S + 1,
          r = j * S + 1,
          v = m == 'slope' ? slopeAt(c, r) : Z(c, r),
          k = (j * cw + i) * 4;
        if (isNaN(v)) {
          im.data[k + 3] = 0;
          continue;
        }
        const col = m == 'slope' ? rampCol(v, CFG.slopeRamp) : rampCol(v, el);
        im.data[k] = col[0];
        im.data[k + 1] = col[1];
        im.data[k + 2] = col[2];
        im.data[k + 3] = 255;
      }
    x.putImageData(im, 0, 0);
    demLayer = L.imageOverlay(cv.toDataURL(), DEM.bounds, { opacity: 0.75, zIndex: 5 }).addTo(M.map);
    M.emit('status');
  }
  function demHtml() {
    const d = DEM,
      ramp = CFG.slopeRamp
        .map((p) => `<span class="sw" style="background:${p[1]}"></span>${p[0]}°`)
        .join(' ');
    return (
      '<h4>Terrain (numerical DEM)</h4>' +
      (d
        ? `<div class="note" style="border-color:var(--ok)">DEM loaded: ${d.w}×${d.h} px, ~${d.my.toFixed(0)} m/px. Elevation ${d.zmin.toFixed(0)} to ${d.zmax.toFixed(0)} m. File: ${esc(d.name || 'loaded file')}. MAREX cannot check which dataset this is.</div>` +
          [
            'slope|Slope (degrees)|calculated from DEM elevations',
            'elev|Elevation colour|DEM values, not MOLA picture',
            'off|Terrain overlay off|',
          ]
            .map((o) => {
              const [v, n, t] = o.split('|');
              return `<label class="card choice"><input type="radio" name="dm" value="${v}" ${dmode == v ? 'checked' : ''}><span class="grow"><b>${n}</b><small>${t}</small></span></label>`;
            })
            .join('') +
          `<div class="slider"><input type="range" min="10" max="100" value="${demLayer ? Math.round(demLayer.options.opacity * 100) : 75}" data-demop aria-label="Terrain overlay opacity"><output>${demLayer ? Math.round(demLayer.options.opacity * 100) : 75}%</output></div>${dmode == 'slope' ? `<div class="lg" style="background:linear-gradient(90deg,${CFG.slopeRamp.map((p) => p[1]).join(',')})"></div>` : ''}<div class="k">${ramp} · illustrative classes</div>`
        : `<p class="k">Slope and roughness are calculated from real elevation numbers, never from a coloured picture. Load an elevation file here. It stays on your computer and must be loaded again each visit.</p>${demSuggest()}<div class="btn-row"><button class="btn primary block" id="dl">Load DEM file…</button></div><input type="file" id="df" accept=".tif,.tiff" hidden>`) +
      '<div id="dst" class="k"></div>'
    );
  }
  function wireDem() {
    const op = document.querySelector('[data-demop]');
    if (op)
      op.oninput = () => {
        if (demLayer) demLayer.setOpacity(op.value / 100);
        op.nextElementSibling.textContent = op.value + '%';
      };
    const dl = $('#dl');
    if (dl) {
      dl.onclick = () => $('#df').click();
      $('#df').onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 8e8) {
          $('#dst').innerHTML = '<span style="color:var(--rs)">Could not use this file: it is ' + (f.size / 1e9).toFixed(1) + ' GB, too large for a browser tab. Crop it to your area first (for example with gdal_translate -projwin).</span>';
          e.target.value = '';
          return;
        }
        $('#dst').textContent = 'Reading ' + f.name + '…';
        f.arrayBuffer()
          .then((b) => {
            DEM = parseTiff(b);
            DEM.name = f.name;
            $('#dst').textContent = 'Building terrain grids…';
            setTimeout(() => {
              buildGrid();
              M.emit('dem');
              M.layersPanel.render();
              setDemMode('slope');
              M.fitTo(DEM.bounds);
              M.emit('status');
            }, 30);
          })
          .catch((err) => {
            DEM = null;
            $('#dst').innerHTML =
              '<span style="color:var(--rs)">Could not use this file: ' + esc(err instanceof RangeError ? 'The file looks cut off or damaged (was the download completed?).' : err.message || err) + '</span>';
          });
      };
    }
    document.querySelectorAll('[name=dm]').forEach((r) => (r.onchange = () => setDemMode(r.value)));
  }
  function terrHtml(ll) {
    if (!DEM)
      return '<div class="k">Elevation / slope</div><p>Not available. Load the DEM in the Layers tab to calculate them from real data.</p>';
    const c = Math.floor((ll[1] - DEM.lon0) / DEM.dlon),
      r = Math.floor((DEM.lat0 - ll[0]) / DEM.dlat),
      z = Z(c, r);
    if (isNaN(z))
      return '<div class="k">Terrain</div><p>Outside the DEM, or a gap in it: no value (this does not mean the ground is flat).</p>';
    const s = slopeAt(c, r),
      ro = roughAt(c, r),
      cl = isNaN(s)
        ? 'n/a'
        : s < 10
          ? 'gentle'
          : s < CFG.steepDeg
            ? 'moderate'
            : s < CFG.impassableDeg
              ? 'steep'
              : 'very steep';
    return `<div class="k">Terrain · your loaded DEM, ~${DEM.my.toFixed(0)} m/px</div><div class="mono">Elevation ${z.toFixed(1)} m<br>Slope ${isNaN(s) ? 'n/a' : s.toFixed(1)}° (${cl})<br>Roughness ${isNaN(ro) ? 'n/a' : ro.toFixed(2)} m RMS</div><p class="k">Elevation is relative to the Mars reference surface. Roughness is measured over about ${Math.round(5 * DEM.my)} m and says nothing about individual rocks. Orbital thermal images are not astronaut-level temperatures.</p>`;
  }
  /* ---- coarse grid + route options (A* on a 100 m grid) ---- */
  function buildGrid() {
    const S = 5,
      gw = Math.floor(DEM.w / S),
      gh = Math.floor(DEM.h / S),
      sl = new Float32Array(gw * gh),
      ro = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const c = i * S + 2,
          r = j * S + 2;
        sl[j * gw + i] = slopeAt(c, r);
        ro[j * gw + i] = roughAt(c, r);
      }
    DEM.g = { S, gw, gh, sl, ro };
  }
  const cellLL = (g, i) => {
    const c = i % g.gw,
      r = (i / g.gw) | 0;
    return [DEM.lat0 - (r * g.S + 2.5) * DEM.dlat, DEM.lon0 + (c * g.S + 2.5) * DEM.dlon];
  };
  function plan(a, b, k) {
    const g = DEM.g,
      N = g.gw * g.gh,
      W = CFG.w,
      rk = new Float32Array(N),
      hz = new Float32Array(N);
    state.haz.forEach((h) => {
      for (let i = 0; i < N; i++) {
        const ll = cellLL(g, i);
        if (Math.abs(ll[0] - h.ll[0]) > 0.05 || Math.abs(ll[1] - h.ll[1]) > 0.05) continue;
        const d = hav(ll, h.ll) / CFG.hazardRadiusKm;
        if (d < 1) hz[i] = Math.max(hz[i], 1 - d);
      }
    });
    for (let i = 0; i < N; i++) {
      const s = g.sl[i],
        o = g.ro[i];
      rk[i] =
        isNaN(s) || isNaN(o) || s > CFG.impassableDeg
          ? NaN
          : W.slope * Math.min(1, s / 25) +
            W.rough * Math.min(1, o / CFG.roughMaxM) +
            W.haz * hz[i] +
            W.unc * CFG.uncertainty;
    }
    const cell = (ll) => {
      const c = Math.round(((ll[1] - DEM.lon0) / DEM.dlon - 2.5) / g.S),
        r = Math.round(((DEM.lat0 - ll[0]) / DEM.dlat - 2.5) / g.S);
      return c < 0 || r < 0 || c >= g.gw || r >= g.gh ? -1 : r * g.gw + c;
    };
    const s0 = cell(a),
      t0 = cell(b);
    if (s0 < 0 || t0 < 0 || isNaN(rk[s0]) || isNaN(rk[t0])) return null;
    const gx = g.S * DEM.mx,
      gy = g.S * DEM.my,
      gd = Math.hypot(gx, gy),
      tc = t0 % g.gw,
      tr = (t0 / g.gw) | 0,
      G_ = new Float64Array(N).fill(Infinity),
      prev = new Int32Array(N).fill(-1),
      hp = [],
      hf = [];
    const push = (f, i) => {
      let n = hp.length;
      hp.push(i);
      hf.push(f);
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (hf[p] <= hf[n]) break;
        [hp[p], hp[n]] = [hp[n], hp[p]];
        [hf[p], hf[n]] = [hf[n], hf[p]];
        n = p;
      }
    };
    const pop = () => {
      const t = hp[0],
        l = hp.pop(),
        lf = hf.pop();
      if (hp.length) {
        hp[0] = l;
        hf[0] = lf;
        let n = 0;
        for (;;) {
          let m = n,
            L2 = 2 * n + 1,
            R2 = L2 + 1;
          if (L2 < hp.length && hf[L2] < hf[m]) m = L2;
          if (R2 < hp.length && hf[R2] < hf[m]) m = R2;
          if (m == n) break;
          [hp[m], hp[n]] = [hp[n], hp[m]];
          [hf[m], hf[n]] = [hf[n], hf[m]];
          n = m;
        }
      }
      return t;
    };
    const hh = (i) => Math.hypot(((i % g.gw) - tc) * gx, (((i / g.gw) | 0) - tr) * gy);
    G_[s0] = 0;
    push(hh(s0), s0);
    while (hp.length) {
      const u = pop();
      if (u == t0) break;
      const uc = u % g.gw,
        ur = (u / g.gw) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const c = uc + dx,
            r = ur + dy;
          if (c < 0 || r < 0 || c >= g.gw || r >= g.gh) continue;
          const v = r * g.gw + c;
          if (isNaN(rk[v])) continue;
          const len = dx && dy ? gd : dx ? gx : gy,
            nc = G_[u] + len * (1 + (k * (rk[u] + rk[v])) / 2);
          if (nc < G_[v]) {
            G_[v] = nc;
            prev[v] = u;
            push(nc + hh(v), v);
          }
        }
    }
    if (prev[t0] < 0 && s0 != t0) return null;
    const ids = [];
    for (let i = t0; i >= 0; i = prev[i]) ids.push(i);
    ids.reverse();
    let d = 0,
      ss = 0,
      sm = 0,
      st = 0,
      sr = 0,
      sh = 0;
    const line = [a, ...ids.map((i) => cellLL(g, i)), b];
    ids.forEach((i, n) => {
      if (n) d += hav(cellLL(g, ids[n - 1]), cellLL(g, i));
      ss += g.sl[i];
      sm = Math.max(sm, g.sl[i]);
      if (g.sl[i] > CFG.steepDeg) st++;
      sr += g.ro[i];
      sh += hz[i];
    });
    d += hav(a, cellLL(g, ids[0])) + hav(cellLL(g, ids.at(-1)), b);
    const n = ids.length,
      hits = new Set();
    for (let i = 1; i < line.length; i++)
      state.haz.forEach((h) => {
        if (segDist(h.ll, line[i - 1], line[i]) <= CFG.hazardRadiusKm) hits.add(h.id);
      });
    const ms = ss / n,
      mr = sr / n,
      mh = sh / n,
      p = {
        slope: W.slope * Math.min(1, ms / 25),
        rough: W.rough * Math.min(1, mr / CFG.roughMaxM),
        haz: W.haz * mh,
        unc: W.unc * CFG.uncertainty,
      };
    return {
      line,
      d,
      ms,
      sm,
      pst: (100 * st) / n,
      mr,
      hits: hits.size,
      hitIds: [...hits],
      p,
      score: 100 * (p.slope + p.rough + p.haz + p.unc),
    };
  }
  // A route through every point (A, waypoints, B): plan each leg, then join them.
  function planVia(P, k) {
    const legs = [];
    for (let i = 1; i < P.length; i++) {
      const q = plan(P[i - 1], P[i], k);
      if (!q) return null;
      legs.push(q);
    }
    const n = legs.reduce((a, q) => a + q.n, 0) || 1,
      w = (f) => legs.reduce((a, q) => a + f(q) * q.n, 0) / n,
      hits = new Set();
    legs.forEach((q) => q.hitIds.forEach((i) => hits.add(i)));
    const p = { slope: w((q) => q.p.slope), rough: w((q) => q.p.rough), haz: w((q) => q.p.haz), unc: w((q) => q.p.unc) };
    return {
      line: legs.reduce((a, q, i) => a.concat(i ? q.line.slice(1) : q.line), []),
      d: legs.reduce((a, q) => a + q.d, 0), ms: w((q) => q.ms), sm: Math.max(...legs.map((q) => q.sm)),
      pst: w((q) => q.pst), mr: w((q) => q.mr), hits: hits.size, p, score: 100 * (p.slope + p.rough + p.haz + p.unc),
    };
  }
  function demSuggest() {
    const rg = CFG.regions.find((r) => r.id == M.areaId()), dm = rg && rg.dem;
    return dm
      ? `<div class="note">Suggested for this area: ${esc(dm.src)}, ${dm.res}${dm.mb ? `, about ${dm.mb} MB` : ''}. <a href="${dm.url}" target="_blank" rel="noopener">${esc(dm.file)}</a>${dm.warn ? '<br>' + esc(dm.warn) : ''}</div>`
      : '<div class="note">No elevation file is set up for this area. You can load any 32-bit float GeoTIFF (uncompressed, simple cylindrical, Mars sphere) that covers it.</div>';
  }
  function wireCmp() {
    const el = $('#rcmp');
    if (!el) return;
    el.innerHTML = lastCmp;
    const bt = $('#cmp');
    if (!bt) return;
    bt.onclick = () => {
      if (!DEM) {
        el.innerHTML =
          '<p class="k">Load the DEM first (Layers tab). Without real elevation numbers MAREX will not call a route terrain-aware.</p>';
        return;
      }
      if (!rt.a || !rt.b) {
        el.innerHTML = '<p class="k">Set points A and B first.</p>';
        return;
      }
      if (!DEM.g) buildGrid();
      el.innerHTML = '<p class="k">Computing three routes…</p>';
      setTimeout(() => {
        if (M.G.opts) M.G.opts.clearLayers();
        else M.G.opts = L.layerGroup().addTo(M.map);
        let h = '';
        [
          ['Shortest', CFG.routeK.short, '#6ea8ff'],
          ['Lowest estimated risk', CFG.routeK.low, '#4fd1a5'],
          ['Balanced', CFG.routeK.bal, '#ffd166'],
        ].forEach(([n, k, col]) => {
          const q = planVia(state.rt.p, k);
          if (!q) {
            h += `<div class="cardr"><b>${n}</b><br><span class="k">No route found inside the DEM (points outside it, in a gap, or blocked by terrain over ${CFG.impassableDeg}°).</span></div>`;
            return;
          }
          L.polyline(q.line, { color: col, weight: 4 }).addTo(M.G.opts);
          const hrs = q.d / CFG.speeds[state.speed][1],
            t = hrs < 1 ? Math.round(hrs * 60) + ' min' : hrs.toFixed(1) + ' h';
          h += `<div class="cardr"><b><span class="sw" style="background:${col}"></span>${n}</b><div class="mono" style="font-size:12px">${q.d.toFixed(2)} km · ${t} at ${CFG.speeds[state.speed][1]} km/h<br>Slope mean ${q.ms.toFixed(1)}° · max ${q.sm.toFixed(1)}° · over ${CFG.steepDeg}°: ${q.pst.toFixed(0)}%<br>Roughness mean ${q.mr.toFixed(2)} m · hazard markers near: ${q.hits}<br>Illustrative score ${q.score.toFixed(0)}/100<br>(slope ${(q.p.slope * 100).toFixed(0)} + rough ${(q.p.rough * 100).toFixed(0)} + hazard ${(q.p.haz * 100).toFixed(0)} + uncertainty ${(q.p.unc * 100).toFixed(0)})</div></div>`;
        });
        lastCmp =
          h +
          '<div class="note">Experimental. Lower score = lower estimated risk, but weights are provisional and unvalidated. Routes use a ~' + Math.round(DEM.g.S * DEM.my) + ' m grid; terrain finer than ' + Math.round(DEM.my) + ' m, rocks and sand are invisible. Missing DEM cells are blocked, never treated as safe. Not a safety assessment.</div>';
        el.innerHTML = lastCmp;
      }, 40);
    };
  }

  T.has = () => !!DEM;
  T.html = terrHtml;
  T.mount = () => {
    const el = $('#demBox');
    if (el) {
      el.innerHTML = demHtml();
      wireDem();
    }
  };
  T.wireCmp = wireCmp;
  T.routeBox = () =>
    '<h4>Terrain-aware options</h4><div class="btn-row"><button class="btn block" id="cmp">Compare 3 route options (uses DEM)</button></div><p class="k">Routes through A, any waypoints, then B.</p><div id="rcmp"></div>';
  T.clearOptions = () => {
    if (M.G.opts) M.G.opts.clearLayers();
    lastCmp = '';
  };

  T.init = function () {
    // Elevation and slope under the cursor, appended to the status-bar coordinates (ui.js writes those first).
    M.map.on('mousemove', (e) => {
      if (!DEM) return;
      const c = Math.floor((e.latlng.lng - DEM.lon0) / DEM.dlon),
        r = Math.floor((DEM.lat0 - e.latlng.lat) / DEM.dlat),
        z = Z(c, r);
      if (isNaN(z)) return;
      const s = slopeAt(c, r);
      $('#b1').textContent += ` · ${z.toFixed(0)} m · ${isNaN(s) ? 'slope n/a' : s.toFixed(1) + '° slope'}`;
    });
  };
})(window.MAREX);
