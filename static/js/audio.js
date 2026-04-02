/* audio.js – Web Audio EQ + real-time analyser
   Strategy: intercept the first <audio> element created after SDK loads,
   OR use a GainNode connected to AudioContext.destination as fallback.
*/
const AudioEngine = (() => {
  let _ctx = null;
  let _analyser = null;
  let _source = null;
  let _gain = null;
  let _filters = [];
  let _connected = false;
  let _audioEl = null;

  const BANDS_HZ = [60, 170, 310, 600, 1000, 3000, 10000];

  const PRESETS = {
    flat:      [ 0,  0,  0,  0,  0,  0,  0],
    bass:      [ 8,  6,  4,  0, -1, -1, -2],
    treble:    [-2, -1,  0,  0,  3,  5,  7],
    pop:       [-1,  3,  5,  4,  2,  0, -1],
    rock:      [ 5,  4,  2, -1, -1,  3,  5],
    jazz:      [ 3,  2,  0,  2,  3,  2,  2],
    classical: [ 5,  3,  0,  0,  0,  3,  5],
    custom:    [ 0,  0,  0,  0,  0,  0,  0],
  };

  /* ── Intercept audio elements created by Spotify SDK ─── */
  const _origCreate = document.createElement.bind(document);
  document.createElement = function(tag, options) {
    const el = _origCreate(tag, options);
    if (tag.toLowerCase() === 'audio' && !_audioEl) {
      _audioEl = el;
      // Delay to let SDK set src
      setTimeout(() => tryConnect(el), 800);
    }
    return el;
  };

  function tryConnect(el) {
    if (_connected) return;
    // Wait until src is set
    if (!el.src && !el.srcObject) {
      setTimeout(() => tryConnect(el), 500);
      return;
    }
    connect(el);
  }

  function connect(el) {
    try {
      if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (_connected) return;

      _source = _ctx.createMediaElementSource(el);

      // Build EQ filter chain
      _filters = BANDS_HZ.map((freq, i) => {
        const f = _ctx.createBiquadFilter();
        f.type = i === 0 ? 'lowshelf' : i === BANDS_HZ.length - 1 ? 'highshelf' : 'peaking';
        f.frequency.value = freq;
        f.gain.value = 0;
        f.Q.value = 1.2;
        return f;
      });

      // Analyser for visualizer
      _analyser = _ctx.createAnalyser();
      _analyser.fftSize = 2048;  // Higher = more frequency detail
      _analyser.smoothingTimeConstant = 0.78;

      _gain = _ctx.createGain();
      _gain.gain.value = 1;

      // Chain: source → filters → gain → analyser → destination
      let node = _source;
      _filters.forEach(f => { node.connect(f); node = f; });
      node.connect(_gain);
      _gain.connect(_analyser);
      _analyser.connect(_ctx.destination);

      _connected = true;
      console.log('[AudioEngine] Connected ✓');

      // Apply saved preset
      const saved = localStorage.getItem('ms_eq_preset') || 'flat';
      applyPreset(saved);
    } catch(e) {
      console.warn('[AudioEngine] Could not connect:', e.message);
    }
  }

  function resume() {
    if (_ctx?.state === 'suspended') _ctx.resume();
  }

  function applyPreset(name) {
    const vals = PRESETS[name] || PRESETS.flat;
    localStorage.setItem('ms_eq_preset', name);
    vals.forEach((v, i) => {
      if (_filters[i]) _filters[i].gain.value = v;
      // Update UI sliders
      const slider = document.getElementById(`eq-${i}`);
      const label  = document.getElementById(`eq-v${i}`);
      if (slider) slider.value = v;
      if (label)  label.textContent = v > 0 ? `+${v}` : `${v}`;
    });
  }

  function setBand(index, value) {
    if (_filters[index]) _filters[index].gain.value = value;
    const label = document.getElementById(`eq-v${index}`);
    if (label) label.textContent = value > 0 ? `+${value}` : `${value}`;
    // Save custom preset
    const custom = BANDS_HZ.map((_, i) => _filters[i]?.gain.value ?? 0);
    PRESETS.custom = custom;
    localStorage.setItem('ms_eq_custom', JSON.stringify(custom));
    localStorage.setItem('ms_eq_preset', 'custom');
    const sel = document.getElementById('eq-preset');
    if (sel) sel.value = 'custom';
  }

  function getAnalyser() { return _analyser; }
  function isConnected()  { return _connected; }

  /* ── Init EQ UI ──────────────────────────────────────── */
  function initUI() {
    // Load saved custom bands
    try {
      const saved = localStorage.getItem('ms_eq_custom');
      if (saved) PRESETS.custom = JSON.parse(saved);
    } catch {}

    // Preset selector
    const sel = document.getElementById('eq-preset');
    if (sel) {
      const savedPreset = localStorage.getItem('ms_eq_preset') || 'flat';
      sel.value = savedPreset;
      // Apply visually even before audio connects
      const vals = PRESETS[savedPreset] || PRESETS.flat;
      vals.forEach((v, i) => {
        const slider = document.getElementById(`eq-${i}`);
        const label  = document.getElementById(`eq-v${i}`);
        if (slider) slider.value = v;
        if (label)  label.textContent = v > 0 ? `+${v}` : `${v}`;
      });

      sel.addEventListener('change', () => {
        if (sel.value !== 'custom') applyPreset(sel.value);
      });
    }

    // Band sliders
    BANDS_HZ.forEach((_, i) => {
      const slider = document.getElementById(`eq-${i}`);
      if (!slider) return;
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        setBand(i, v);
      });
    });

    // Crossfade slider
    const cfR = document.getElementById('crossfade-r');
    const cfL = document.getElementById('crossfade-lbl');
    if (cfR) {
      cfR.value = localStorage.getItem('ms_crossfade') || 0;
      if (cfL) cfL.textContent = `${cfR.value}s`;
      cfR.addEventListener('input', () => {
        if (cfL) cfL.textContent = `${cfR.value}s`;
        localStorage.setItem('ms_crossfade', cfR.value);
      });
    }
  }

  return { initUI, resume, applyPreset, setBand, getAnalyser, isConnected, PRESETS };
})();
