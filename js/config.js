/* =====================================================================
   config.js — all data and tunables live here.
   Add a layer, site, hazard category or region by editing this file only.
   ===================================================================== */
(function (M) {
  'use strict';

  M.CFG = {
    version: '3.1.0',

    // Tile sources, tried in this order when a layer loads nothing (see js/tiles.js):
    // trek -> api.nasa.gov -> USGS WMS (only layers with `wms`) -> Esri CTX (only layers with `esri`)
    trek: 'https://trek.nasa.gov/tiles/Mars/EQ/',
    apiWmts: 'https://api.nasa.gov/mars-wmts/catalog/',
    usgsWms: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map',
    failoverAfter: 8,          // switch to the next source after this many failed tiles with none loaded
    minZoom: 3, maxZoom: 18,   // HiRISE is native to zoom 17, so the map must go deeper than 13

    // Imagery is global, so every region can be shown. Only Jezero has curated sites.
    // mz = minimum zoom for that region. The last region is the catch-all for points outside the others.
    regions: [
      { id: 'jez',  name: 'Jezero Crater · prototype target', c: [18.45, 77.45],  z: 9, mz: 3, b: [[16.8, 75.8],   [20.2, 79.2]],
        dem: { src: 'USGS/JPL Mars 2020 CTX DEM', res: '20 m/px', mb: 87, file: 'M20_JezeroCrater_CTXDEM_20m.tif', url: 'https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif' } },
      { id: 'gale', name: 'Gale Crater',    c: [-5.4, 137.8],   z: 8, mz: 3, b: [[-7.6, 135.4],  [-3.2, 140.2]],
        dem: { src: '30 m HRSC DTM mosaic of Gale Crater (Persaud, Putri & Muller 2021, UCL, Zenodo)', res: '30 m/px', mb: 0, file: 'Zenodo record 5808354', url: 'https://zenodo.org/record/5808354', warn: "This file's size and format were not checked. MAREX will tell you if it cannot read it. The USGS 1 m MSL Gale DEM is 3.6 GB, too large for a browser." } },
      { id: 'oly',  name: 'Olympus Mons',   c: [18.65, -133.8], z: 7, mz: 3, b: [[9, -146],      [28, -121]] },
      { id: 'mars', name: 'Whole Mars · imagery',     c: [10, 60],        z: 4, mz: 3, b: [[-90, -180],    [90, 180]] }
    ],

    // Equatorial radius = the sphere NASA Trek tiles are projected on (IAU 2000). The mean radius is 3389.5 km (0.2 % smaller).
    marsRadiusKm: 3396.19,
    hazardRadiusKm: 1.0,

    // Terrain (DEM) and route-option settings. ALL thresholds and weights are illustrative, not validated.
    demUrl: 'https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif',
    slopeRamp: [[0, '#2b8a3e'], [10, '#e8d17a'], [20, '#f08a24'], [30, '#c92a2a']], // degrees -> colour
    steepDeg: 20, impassableDeg: 30, roughMaxM: 3, uncertainty: 0.3,
    w: { slope: 0.35, rough: 0.25, haz: 0.25, unc: 0.15 },
    routeK: { short: 0, low: 15, bal: 3 },
    solHours: 24.66,
    landing: [18.4447, 77.4508], // Octavia E. Butler Landing (Perseverance)

    // km/h — planning inputs only, not mission data
    speeds: [['Rover – slow', 0.04], ['Rover – fast', 0.12], ['Walking astronaut', 4]],

    // Layer fields: set = Trek tileset name · ext = file type · alt = other file type to try when a tile fails
    // native = deepest zoom with real tiles · bounds = area covered (tiles outside are never requested)
    // wms = USGS WMS layer name (backup) · esri = Esri ArcGIS MapServer URL (backup) · opacity = overlay start opacity.
    // Change `set` / `ext` / `native` if a layer shows blank.
    base: [
      { id: 'vis',  name: 'Viking colour mosaic',       desc: 'MDIM 2.1 · 232 m/px · global. Always drawn underneath.', set: 'Mars_Viking_MDIM21_ClrMosaic_global_232m', ext: 'jpg', native: 7, wms: 'MDIM21_color' },
      { id: 'ctx',  name: 'CTX Jezero mosaic',          desc: 'MRO Context Camera · ~6 m/px · Jezero only', only: 'jez', set: 'Jezero_CTX_BlockAdj_dd', ext: 'png', alt: 'jpg', native: 12, esri: 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer' },
      { id: 'hir',  name: 'HiRISE Jezero mosaic',       desc: 'MRO HiRISE · 25 cm/px · landing area only (about 21 km wide)', only: 'jez', set: 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', ext: 'png', alt: 'jpg', native: 17, bounds: [[18.3068, 77.2229], [18.6693, 77.5840]] },
      { id: 'mola', name: 'Elevation colour (MOLA)',    desc: 'MOLA colourised shaded relief · 463 m/px · a picture, not numbers', set: 'Mars_MGS_MOLA_ClrShade_merge_global_463m', ext: 'jpg', native: 6 },
      { id: 'dir',  name: 'Daytime infrared (THEMIS)',  desc: 'THEMIS day IR v12 · 100 m/px · global', set: 'Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v12_clon0_ly', ext: 'jpg', alt: 'png', native: 8, wms: 'THEMIS_controlled' }
    ],
    overlays: [
      { id: 'nir',   name: 'Night infrared (THEMIS)', desc: 'THEMIS night IR v14 · 100 m/px · 60°N–60°S. Brighter = held more heat.', set: 'Mars_MO_THEMIS-IR-Night_mosaic_60N60S_100m_v14_clon0_ly', ext: 'jpg', alt: 'png', native: 8, opacity: 0.7, lat: 60, wms: 'THEMIS_night' },
      { id: 'melev', name: 'Elevation colour ramp',   desc: 'MOLA colour relief over the base', set: 'Mars_MGS_MOLA_ClrShade_merge_global_463m', ext: 'jpg', native: 6, opacity: 0.5 }
    ],

    // [id, label, colour]
    cats: [
      ['slope', 'Steep slope', '#e0653a'], ['depr', 'Deep depression', '#a78bfa'], ['unst', 'Unstable terrain', '#f0b429'],
      ['cave', 'Potential cavity', '#6ea8ff'], ['rock', 'Rock field', '#c98b5a'], ['crack', 'Fracture / crack', '#ff6b9d'],
      ['sand', 'Soft sand', '#e8d17a'], ['unex', 'Unexplored', '#8091ad'], ['oth', 'Other', '#3ddc97']
    ],
    risks: ['Low', 'Moderate', 'High', 'Unknown'],
    riskColors: { Low: '#4fd1a5', Moderate: '#f0b429', High: '#ff5a3c', Unknown: '#8091ad' },
    confidences: ['Low', 'Medium', 'High'],

    // status: verified | interpreted | unconfirmed. Coordinates are approximate, read from public maps.
    sites: [
      { reg: 'jez', n: 'Octavia E. Butler Landing', ll: [18.4447, 77.4508], st: 'verified',    kind: 'Landing site',       txt: 'Perseverance landing location (NASA/JPL).' },
      { reg: 'jez', n: 'Jezero Crater centre',      ll: [18.38, 77.58],     st: 'verified',    kind: 'Terrain reference',  txt: 'Approximate crater centre.' },
      { reg: 'jez', n: 'Western delta front',       ll: [18.46, 77.365],    st: 'interpreted', kind: 'Geological feature', txt: 'Eroded river-delta scarp, western crater floor. Position approximate.' },
      { reg: 'jez', n: 'Kodiak butte',              ll: [18.435, 77.405],   st: 'interpreted', kind: 'Geological feature', txt: 'Isolated delta remnant. Position approximate.' },
      { reg: 'jez', n: 'Northern crater rim',       ll: [18.8, 77.59],      st: 'interpreted', kind: 'Terrain reference',  txt: 'Approximate rim position.' },
      { reg: 'gale', n: 'Bradbury Landing',  ll: [-4.5895, 137.4417], st: 'verified',    kind: 'Landing site',      txt: 'Curiosity (MSL) landing location, 6 Aug 2012, on Aeolis Palus (NASA/JPL).' },
      { reg: 'gale', n: 'Aeolis Mons (Mount Sharp)', ll: [-5.08, 137.85], st: 'interpreted', kind: 'Geological feature', txt: 'Layered mound about 5.5 km high at the centre of Gale. Position approximate.' },
      { reg: 'gale', n: 'Gale Crater centre', ll: [-5.4, 137.8],     st: 'interpreted', kind: 'Terrain reference', txt: 'Approximate crater centre, 154 km across. Position approximate.' },
      { reg: 'oly',  n: 'Olympus Mons summit', ll: [18.65, -133.8],  st: 'interpreted', kind: 'Geological feature', txt: 'Summit caldera of the tallest volcano on Mars. Position approximate.' }
    ],

    // DEMONSTRATION ONLY — not real detections. Replace with surveyed data.
    cands: [
      { n: 'Candidate depression A', ll: [18.565, 77.335], r: 0.45 },
      { n: 'Candidate depression B', ll: [18.372, 77.44],  r: 0.4 },
      { n: 'Candidate void C',       ll: [18.33, 77.55],   r: 0.5 }
    ]
  };

  M.STATUS = {
    verified:    ['Verified',    'ver'],
    interpreted: ['Interpreted', 'int'],
    unconfirmed: ['Unconfirmed', 'unc'],
    sim:         ['Simulated',   'sim']
  };
})((window.MAREX = window.MAREX || {}));
