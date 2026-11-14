/* =====================================================================
   weather.js: Mars clock at Jezero. COMPUTED live (Mars24 algorithm: sol,
   local solar time, season Ls, sun position) plus dated MEDA reports.
   There is no public live weather feed, so none is faked.
   ===================================================================== */
(function (M) {
  'use strict';
  const { U } = M;
  const { $ } = U;
  const W = (M.weather = {});

  const LAND = Date.UTC(2021, 1, 18, 20, 55, 0),
    JZ = { lon: 77.45, lat: 18.44 };
  function mars24(ms, lonE) {
    const jdUT = ms / 864e5 + 2440587.5,
      jt = jdUT + 69.184 / 86400,
      dt = jt - 2451545.0,
      d2r = Math.PI / 180;
    const msd = (jt - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626,
      mtc = 24 * (((msd % 1) + 1) % 1),
      M = 19.3871 + 0.52402073 * dt,
      afms = 270.3871 + 0.524038496 * dt;
    const A = [0.0071, 0.0057, 0.0039, 0.0037, 0.0021, 0.002, 0.0018],
      T = [2.2353, 2.7543, 1.1177, 15.7866, 2.1354, 2.4694, 32.8493],
      P = [49.409, 168.173, 191.837, 21.736, 15.704, 95.528, 49.095];
    let pbs = 0;
    for (let i = 0; i < 7; i++) pbs += A[i] * Math.cos(((0.985626 * dt) / T[i] + P[i]) * d2r);
    const nm =
      (10.691 + 3e-7 * dt) * Math.sin(M * d2r) +
      0.623 * Math.sin(2 * M * d2r) +
      0.05 * Math.sin(3 * M * d2r) +
      0.005 * Math.sin(4 * M * d2r) +
      0.0005 * Math.sin(5 * M * d2r) +
      pbs;
    const ls = (((afms + nm) % 360) + 360) % 360,
      eot =
        (2.861 * Math.sin(2 * ls * d2r) -
          0.071 * Math.sin(4 * ls * d2r) +
          0.002 * Math.sin(6 * ls * d2r) -
          nm) /
        15; // hours
    const lmst = (((mtc + lonE / 15) % 24) + 24) % 24,
      ltst = (((lmst + eot) % 24) + 24) % 24,
      dec = Math.asin(0.42565 * Math.sin(ls * d2r)) / d2r + 0.25 * Math.sin(ls * d2r);
    return { msd, mtc, ls, eot, lmst, ltst, dec, sol: Math.floor(msd + lonE / 360) };
  }
  function sunAt(m, lat) {
    const d2r = Math.PI / 180,
      p = lat * d2r,
      dl = m.dec * d2r,
      h = (m.ltst - 12) * 15 * d2r,
      alt = Math.asin(Math.sin(p) * Math.sin(dl) + Math.cos(p) * Math.cos(dl) * Math.cos(h)) / d2r,
      c = -Math.tan(p) * Math.tan(dl),
      H = Math.acos(Math.max(-1, Math.min(1, c))) / d2r / 15;
    return { alt, rise: 12 - H, set: 12 + H };
  }
  const hm = (h, sec) => {
    h = ((h % 24) + 24) % 24;
    const H = Math.floor(h),
      M = Math.floor((h - H) * 60),
      S = Math.floor(((h - H) * 60 - M) * 60);
    return (
      String(H).padStart(2, '0') +
      ':' +
      String(M).padStart(2, '0') +
      (sec ? ':' + String(S).padStart(2, '0') : '')
    );
  };
  const seasonOf = (ls) =>
    ls < 90
      ? 'Northern spring'
      : ls < 180
        ? 'Northern summer'
        : ls < 270
          ? 'Northern autumn'
          : 'Northern winter';
  const myOf = (ms) => 37 + Math.floor((ms - Date.UTC(2022, 11, 26)) / (686.98 * 864e5));
  function nowMars() {
    const ms = Date.now(),
      c = M.map.getCenter(),
      lon = ((((c.lng + 180) % 360) + 360) % 360) - 180,
      lat = Math.max(-90, Math.min(90, c.lat)),
      m = mars24(ms, lon),
      l = mars24(LAND, lon);
    return Object.assign(m, { psol: m.sol - l.sol, sun: sunAt(m, lat), my: myOf(ms), ms, lat, lon });
  }
  function tickWx() {
    const m = nowMars(),
      chip = $('#wx');
    chip.dataset.day = m.sun.alt > 0;
    chip.textContent = `${M.atJez() ? 'Jezero' : 'Map centre'} · Sol ${m.psol} · ${hm(m.ltst)} · Ls ${m.ls.toFixed(0)}° · ${m.sun.alt > 0 ? 'day' : 'night'}`;
    const e = $('#wxl');
    if (!e) return;
    e.innerHTML = `<div class="k">For the middle of the map: ${U.fmt([m.lat, m.lon])}. Pan the map to see local time elsewhere on Mars.</div><div class="mono">Earth (UTC) ${new Date(m.ms).toISOString().slice(0, 19).replace('T', ' ')}<br>Mission sol ${m.psol} <span class="k">(Perseverance, landing = sol 0)</span><br>Local mean solar time ${hm(m.lmst, 1)}<br>Local true solar time ${hm(m.ltst, 1)}<br>Season Ls ${m.ls.toFixed(1)}° · ${seasonOf(m.ls)} · Mars year ≈ ${m.my}<br>Sun ${m.sun.alt > 0 ? 'up' : 'down'}, elevation ${m.sun.alt.toFixed(0)}°<br>Sunrise ≈ ${hm(m.sun.rise)} · sunset ≈ ${hm(m.sun.set)} <span class="k">(true solar time, approx.)</span></div>`;
  }
  function renderWea() {
    $('#wea').innerHTML =
      `<h4>Mars clock · computed live</h4><div id="wxl"></div><div class="note">This is astronomy calculated from the date, not a weather measurement.</div>
<h4>Measured weather · Perseverance MEDA · NOT live</h4><div class="note">These readings were taken at Jezero. They do not describe other places on Mars.</div>
<div class="cardr"><span class="tag ver">Measured</span><b>First reports (sols 43–44, 3–4 Apr 2021)</b><div class="mono" style="font-size:12px">Air high −22 °C, low −83 °C<br>Wind gusts about 10 m/s<br>Pressure 718 Pa at the first report</div><div class="k"><a href="https://www.nasa.gov/directorates/stmd/nasas-first-weather-report-from-jezero-crater-on-mars/" target="_blank" rel="noopener">NASA</a></div></div>
<div class="cardr"><span class="tag ver">Measured</span><b>Typical daily range</b><div class="mono" style="font-size:12px">Surface −83 °C before dawn to +5 °C at noon<br>Air −83 °C to −23 °C</div><div class="k"><a href="https://science.nasa.gov/missions/mars-2020-perseverance/daily-records-of-atmospheric-temperature-with-perseverance" target="_blank" rel="noopener">NASA Science</a></div></div>
<div class="cardr"><span class="tag ver">Measured</span><b>First-year summary (published Jan 2023)</b><div class="mono" style="font-size:12px">Mean air about −55 °C<br>Day–night swing 50–60 °C<br>Pressure varies daily and by season</div><div class="k"><a href="https://www.space.com/perseverance-rover-mars-weather-report" target="_blank" rel="noopener">Space.com report</a> · <a href="https://www.nature.com/articles/s41561-022-01084-0" target="_blank" rel="noopener">Nature Geoscience</a></div></div>
<h4>Why not a live reading?</h4><p class="k">I searched for a live Mars weather feed. InSight's feed ended in 2022, and Perseverance MEDA data reaches the public through the NASA PDS archive in batches, so no public live feed was found. MAREX will not show a made-up "current temperature". When you have a source, put it in CFG and we can add it.</p>
<div class="note">Orbital infrared images (THEMIS) are not astronaut-level temperatures.</div>`;
    tickWx();
  }

  W.init = function () {
    renderWea();
    setInterval(() => {
      if (!document.hidden) tickWx();
    }, 1000);
    $('#wx').onclick = () => {
      M.ui.tab('wea');
      if (document.body.classList.contains('hide-left')) M.ui.togglePanel('left');
    };
  };
})(window.MAREX);
