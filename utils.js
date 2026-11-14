/* =====================================================================
   utils.js — pure helpers (no map code): DOM, maths on Mars' sphere,
   formatting, storage, events.
   ===================================================================== */
(function (M) {
  'use strict';
  const U = (M.U = {});
  const rad = (x) => (x * Math.PI) / 180;
  const R = () => M.CFG.marsRadiusKm;

  /* ---------- DOM ---------- */
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Tiny event bus ---------- */
  const handlers = {};
  M.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  M.emit = (ev, data) => {
    (handlers[ev] || []).forEach((fn) => {
      try { fn(data); } catch (e) { console.error('[MAREX] handler error for "' + ev + '"', e); }
    });
  };

  /* ---------- Maths (Mars radius, never Earth's) ---------- */
  U.rad = rad;
  U.hav = (a, b) => {
    const dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1]);
    const x = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2;
    return 2 * R() * Math.asin(Math.min(1, Math.sqrt(x)));
  };
  // Leaflet circles on our CRS take their radius in degrees, not metres.
  U.kmDeg = (km) => km / (R() * Math.PI / 180);

  // Distance in km from point p to segment a-b (local flat approximation, fine at rover scale)
  U.segDist = (p, a, b) => {
    const k = Math.cos(rad(p[0])), kmPerDeg = rad(1) * R();
    const X = (q) => [(q[1] - p[1]) * k * kmPerDeg, (q[0] - p[0]) * kmPerDeg];
    const A = X(a), B = X(b), dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, -(A[0] * dx + A[1] * dy) / L2)) : 0;
    return Math.hypot(A[0] + t * dx, A[1] + t * dy);
  };

  U.bearing = (a, b) => {
    const p1 = rad(a[0]), p2 = rad(b[0]), dl = rad(b[1] - a[1]);
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };
  U.compass = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

  U.valid = (ll) =>
    Array.isArray(ll) && ll.length >= 2 && isFinite(+ll[0]) && isFinite(+ll[1]) &&
    Math.abs(+ll[0]) <= 90 && +ll[1] >= -180 && +ll[1] <= 360;

  /* ---------- Formatting ---------- */
  function dms(v, pos, neg) {
    const hemi = v >= 0 ? pos : neg;
    let t = Math.round(Math.abs(v) * 360000); // hundredths of an arc-second
    const s = (t % 6000) / 100;
    t = Math.floor(t / 6000);
    return `${Math.floor(t / 60)}° ${t % 60}′ ${s.toFixed(2)}″ ${hemi}`;
  }
  U.fmt = (ll) =>
    M.state && M.state.coordFmt === 'dms'
      ? `${dms(ll[0], 'N', 'S')}, ${dms(ll[1], 'E', 'W')}`
      : `${Math.abs(ll[0]).toFixed(5)}° ${ll[0] >= 0 ? 'N' : 'S'}, ${Math.abs(ll[1]).toFixed(5)}° ${ll[1] >= 0 ? 'E' : 'W'}`;
  U.fmtShort = (ll) => `${ll[0].toFixed(3)}, ${ll[1].toFixed(3)}`;
  U.normLon = (ll) => [+ll[0], +ll[1] > 180 ? +ll[1] - 360 : +ll[1]]; // 0–360 longitudes -> -180…180
  U.fmtDist = (km) => (km < 0.9995 ? Math.round(km * 1000) + ' m' : km.toFixed(2) + ' km');
  U.fmtTime = (hours) =>
    hours <= 0 ? '0 min' : hours < 1 ? Math.max(1, Math.round(hours * 60)) + ' min'
      : hours < 48 ? hours.toFixed(1) + ' h'
      : (hours / M.CFG.solHours).toFixed(1) + ' sols';
  U.fmtBearing = (deg) => `${Math.round(deg)}° ${U.compass(deg)}`;

  /* Accepts decimal ("18.44, 77.45", "18.44N 77.45E", "-5.4 137.8") and
     degrees-minutes-seconds ("18°26′40.9″N 77°27′2.9″E", "18 26 40.9 N, 77 27 2.9 E"). */
  U.parseCoords = (text) => {
    const s = String(text).trim().toUpperCase();
    if (!s) return null;
    if (s.replace(/-?\d+(?:\.\d+)?|[NSEW]|[\s°º′″'"’”,;]/g, '')) return null; // stray characters: not coordinates
    const toks = s.match(/-?\d+(?:\.\d+)?|[NSEW]/g) || [];
    const groups = [];
    let cur = [];
    for (const t of toks) {
      if (/[NSEW]/.test(t)) { if (!cur.length) return null; groups.push({ nums: cur, h: t }); cur = []; }
      else cur.push(t);
    }
    if (cur.length) groups.push({ nums: cur, h: null });
    if (groups.length === 1 && !groups[0].h && [2, 4, 6].includes(groups[0].nums.length)) {
      const n = groups[0].nums, k = n.length / 2;
      groups.splice(0, 1, { nums: n.slice(0, k), h: null }, { nums: n.slice(k), h: null });
    }
    if (groups.length !== 2 || groups.some((g) => g.nums.length > 3)) return null;
    let [a, b] = groups;
    if ((a.h === 'E' || a.h === 'W') && (b.h === 'N' || b.h === 'S')) [a, b] = [b, a]; // "77.45E 18.44N"
    if ((a.h && !'NS'.includes(a.h)) || (b.h && !'EW'.includes(b.h))) return null;
    const val = (g) => {
      const neg = g.nums[0].startsWith('-');
      const [d, m = 0, sec = 0] = g.nums.map((x, i) => (i ? +x : Math.abs(+x)));
      if (g.nums.slice(1).some((x) => +x < 0) || m >= 60 || sec >= 60) return NaN;
      return (neg ? -1 : 1) * (d + m / 60 + sec / 3600);
    };
    let lat = val(a), lon = val(b);
    if (isNaN(lat) || isNaN(lon)) return null;
    if (a.h === 'S') lat = -Math.abs(lat);
    if (b.h === 'W') lon = -Math.abs(lon);
    if (Math.abs(lat) > 90 || lon < -180 || lon > 360) return { error: 'Latitude must be -90…90 and longitude -180…360 (east positive).' };
    if (lon > 180) lon -= 360;
    return { ll: [lat, lon] };
  };

  /* ---------- Geometry helpers ---------- */
  // Area (km²) of a simple polygon on the Mars sphere (Chamberlain–Duquette; exact for parallel/meridian boxes).
  U.polyArea = (pts) => {
    if (pts.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += rad(b[1] - a[1]) * (2 + Math.sin(rad(a[0])) + Math.sin(rad(b[0])));
    }
    return (Math.abs(s) * R() * R()) / 2;
  };
  U.fmtArea = (km2) =>
    km2 < 1 ? Math.round(km2 * 1e6).toLocaleString('en') + ' m²' : km2.toFixed(km2 < 100 ? 3 : 1) + ' km²';

  // Points of a true geodesic circle (radius in km). A Leaflet L.circle on this CRS is a circle in
  // *degrees*, i.e. squashed east-west by cos(latitude), so we draw polygons instead.
  U.circlePoly = (c, km, n = 72) => {
    const p1 = rad(c[0]), l1 = rad(c[1]), dd = km / R(), out = [];
    for (let i = 0; i < n; i++) {
      const th = (2 * Math.PI * i) / n;
      const p2 = Math.asin(Math.sin(p1) * Math.cos(dd) + Math.cos(p1) * Math.sin(dd) * Math.cos(th));
      const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(dd) * Math.cos(p1), Math.cos(dd) - Math.sin(p1) * Math.sin(p2));
      out.push([(p2 * 180) / Math.PI, (l2 * 180) / Math.PI]);
    }
    return out;
  };

  /* ---------- Storage (prefix kept as 'jz_' so existing saved data still loads) ---------- */
  U.store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('jz_' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('jz_' + k, JSON.stringify(v)); } catch { /* private mode etc. */ } }
  };

  /* ---------- Misc ---------- */
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.clone = (o) => JSON.parse(JSON.stringify(o));

  U.download = (name, text, type = 'application/json') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  U.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
      t.remove(); return ok;
    }
  };

  // Spreadsheet formula-injection guard for CSV cells
  U.csvCell = (v) => {
    let s = String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // numbers (e.g. -5.4) must stay numeric
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
})(window.MAREX);
