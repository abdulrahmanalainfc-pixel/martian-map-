/* =====================================================================
   measure.js — ruler tool: click points on the map to get distances,
   and (from 3 points) perimeter + enclosed area. Can be promoted to a
   route with one click.
   ===================================================================== */
(function (M) {
  'use strict';
  const { U } = M;
  const Me = (M.measure = { pts: [] });
  const COL = '#5ee6ff';

  Me.total = () => { let d = 0; for (let i = 1; i < Me.pts.length; i++) d += U.hav(Me.pts[i - 1], Me.pts[i]); return d; };

  // d = open path length; perim / area only exist for 3+ points (closing leg back to the first point)
  Me.stats = function () {
    const p = Me.pts, d = Me.total();
    if (p.length < 3) return { d, perim: null, area: null };
    return { d, perim: d + U.hav(p[p.length - 1], p[0]), area: U.polyArea(p) };
  };

  Me.draw = function () {
    M.G.measure.clearLayers();
    const p = Me.pts;
    if (p.length > 2) L.polygon(p, { color: COL, weight: 1, dashArray: '4 4', fillOpacity: 0.08, interactive: false }).addTo(M.G.measure);
    if (p.length > 1) L.polyline(p, { color: COL, weight: 3, interactive: false }).addTo(M.G.measure);
    let cum = 0;
    p.forEach((q, i) => {
      const cm = L.circleMarker(q, { radius: 4, color: '#fff', weight: 2, fillColor: COL, fillOpacity: 1, interactive: false }).addTo(M.G.measure);
      if (i > 0) {
        cum += U.hav(p[i - 1], q);
        cm.bindTooltip(U.fmtDist(cum), { permanent: true, direction: 'top', offset: [0, -6], className: 'meas-tip' });
      }
    });
    const s = Me.stats();
    M.emit('measure', p.length > 1 ? `Total ${U.fmtDist(s.d)}` + (s.area !== null ? ` · area ${U.fmtArea(s.area)}` : '') : '');
  };

  Me.add = (ll) => { Me.pts.push([ll[0], ll[1]]); Me.draw(); };
  Me.undo = () => { Me.pts.pop(); Me.draw(); };
  Me.clear = () => { Me.pts = []; Me.draw(); };
  Me.toRoute = () => { if (Me.pts.length > 1) { M.route.set(Me.pts); M.ui.tab('rou'); M.ui.toast('Measurement copied to the route planner', { type: 'ok' }); } };

  Me.init = function () {
    // starting a new measurement wipes the old one
    M.on('mode', ({ mode, prev }) => { if (mode === 'measure' && prev !== 'measure') Me.clear(); });
  };
})(window.MAREX);
