/* =====================================================================
   main.js — start-up. Load order (see index.html):
   config → utils → state → tiles → mapview → layers/sites/hazards/inspector/
   route/measure/search → ui → main
   ===================================================================== */
(function (M) {
  'use strict';
  if (!M.map) return; // mapview.js already showed a friendly error (Leaflet missing)

  const { state } = M;

  M.ui.init();
  M.layersPanel.init();
  M.sites.init();
  M.hazards.init();
  M.route.init();
  M.measure.init();
  M.inspect.init();
  M.search.init();
  M.terrain.init();
  M.weather.init();

  // One click handler for the map, routed by the active tool.
  M.map.on('click', (e) => {
    const ll = [e.latlng.lat, e.latlng.lng];
    switch (state.mode) {
      case 'haz': M.hazards.add(ll); break; // stays active (Esc to finish) so a survey can place many markers
      case 'route': M.route.addPt(ll); break;
      case 'measure': M.measure.add(ll); break;
      default: M.inspect.point(ll);
    }
  });

  // Re-open the minimap and status once the layout has settled.
  window.addEventListener('resize', M.U.debounce(() => { M.map.invalidateSize(); M.mini.invalidateSize(); }, 150));

  M.emit('status');
  console.info('MAREX v' + M.CFG.version + ' ready');
})(window.MAREX);
