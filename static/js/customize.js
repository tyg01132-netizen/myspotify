/* customize.js */
const Customize = (() => {
  let P = {};

  const COLORS = {
    green:[29,185,84], blue:[10,132,255], purple:[191,90,242],
    orange:[255,159,10], red:[255,69,58], pink:[255,55,95],
    teal:[90,200,250], yellow:[255,214,10]
  };

  function load()  { try { P = JSON.parse(localStorage.getItem('ms_prefs') || '{}'); } catch { P = {}; } }
  function save()  { localStorage.setItem('ms_prefs', JSON.stringify(P)); }
  function get(k, d) { return k in P ? P[k] : d; }
  function getPref(k, d) { return get(k, d); }
  function set(k, v) { P[k] = v; save(); }

  function applyAccent(name, hex) {
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim();
    if (name === 'custom' && hex) {
      applyHex(hex);
    } else if (COLORS[name]) {
      const [r, g, b] = COLORS[name];
      document.body.classList.add(`theme-${name}`);
      const root = document.documentElement;
      root.style.setProperty('--ar', r);
      root.style.setProperty('--ag', g);
      root.style.setProperty('--ab', b);
    }
  }

  function applyHex(hex) {
    if (!hex || hex.length < 7) return;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const root = document.documentElement;
    root.style.setProperty('--ar', r);
    root.style.setProperty('--ag', g);
    root.style.setProperty('--ab', b);
  }

  function applyPbStyle(style) {
    document.body.classList.remove('pb-compact', 'pb-immersive');
    if (style === 'compact')   document.body.classList.add('pb-compact');
    if (style === 'immersive') document.body.classList.add('pb-immersive');
    document.documentElement.style.setProperty('--pb-h',
      style === 'compact' ? '64px' : style === 'immersive' ? '116px' : '90px');
  }

  function applyIsland(enabled) {
    const island  = document.getElementById('island');
    const fallback= document.getElementById('fallback-nav');
    if (island)   island.style.display   = enabled ? '' : 'none';
    if (fallback) fallback.style.display = enabled ? 'none' : 'flex';
  }

  function applyHomeLayout(layout) {
    document.body.classList.remove('layout-bento', 'layout-minimal', 'layout-magazine');
    document.body.classList.add(`layout-${layout}`);
    // Update picker UI
    document.querySelectorAll('.layout-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === layout);
    });
  }

  function applyPlayerBarToggles() {
    const show = (id, val) => { const el = document.getElementById(id); if (el) el.style.display = val ? '' : 'none'; };
    show('pb-like',       get('pb_like',    true));
    show('pb-shuffle',    get('pb_shuf',    true));
    show('pb-repeat',     get('pb_shuf',    true));
    show('pb-vol-wrap',   get('pb_vol',     true));
    show('pb-mute',       get('pb_vol',     true));
    show('pb-lyrics-btn', get('pb_lyr',     true));
    const miniViz = document.getElementById('pb-mini-viz');
    if (miniViz) miniViz.classList.toggle('show', get('pb_miniviz', true));
    document.querySelectorAll('.pb-time').forEach(t => {
      t.style.display = get('pb_time', true) ? '' : 'none';
    });
  }

  function syncToggle(id, key, def, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = get(key, def);
    el.addEventListener('change', () => { set(key, el.checked); fn?.(el.checked); });
  }

  function updateSwatchActive(name) {
    document.querySelectorAll('.sw').forEach(s => s.classList.remove('active'));
    const t = document.querySelector(`.sw[data-color="${name}"]`) || document.getElementById('sw-custom');
    t?.classList.add('active');
  }

  function init() {
    load();

    // ── Accent color ─────────────────────────────
    applyAccent(get('accent', 'green'), get('accent_hex'));
    updateSwatchActive(get('accent', 'green'));

    document.querySelectorAll('.sw[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.color;
        applyAccent(c); set('accent', c); set('accent_hex', null);
        updateSwatchActive(c);
      });
    });
    const swCustom = document.getElementById('sw-custom');
    const colorInp = document.getElementById('custom-color-inp');
    swCustom?.addEventListener('click', () => colorInp?.click());
    colorInp?.addEventListener('input', () => {
      applyHex(colorInp.value);
      set('accent', 'custom'); set('accent_hex', colorInp.value);
      updateSwatchActive('custom');
    });
    if (get('accent') === 'custom' && get('accent_hex')) {
      if (colorInp) colorInp.value = get('accent_hex');
    }

    // ── Home layout ───────────────────────────────
    applyHomeLayout(get('home_layout', 'bento'));
    document.querySelectorAll('.layout-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        set('home_layout', btn.dataset.layout);
        applyHomeLayout(btn.dataset.layout);
        HomeView?.render?.();
      });
    });

    // ── Player bar style ──────────────────────────
    const savedStyle = get('pb_style', 'normal');
    applyPbStyle(savedStyle);
    document.querySelectorAll('.style-pick').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === savedStyle);
      btn.addEventListener('click', () => {
        applyPbStyle(btn.dataset.style);
        set('pb_style', btn.dataset.style);
        document.querySelectorAll('.style-pick').forEach(b => b.classList.toggle('active', b.dataset.style === btn.dataset.style));
        const sel = document.getElementById('pb-style-sel');
        if (sel) sel.value = btn.dataset.style;
      });
    });
    const pbSel = document.getElementById('pb-style-sel');
    if (pbSel) {
      pbSel.value = savedStyle;
      pbSel.addEventListener('change', () => {
        applyPbStyle(pbSel.value); set('pb_style', pbSel.value);
        document.querySelectorAll('.style-pick').forEach(b => b.classList.toggle('active', b.dataset.style === pbSel.value));
      });
    }

    // ── Background ────────────────────────────────
    const applyGrain   = v => document.body.classList.toggle('grain-on', v);
    const applyAmbient = v => document.body.classList.toggle('ambient-off', !v);
    syncToggle('cust-ambient', 'ambient', true,  applyAmbient);
    syncToggle('cust-grain',   'grain',   true,  applyGrain);
    syncToggle('t-ambient',    'ambient', true,  applyAmbient);
    syncToggle('t-grain',      'grain',   true,  applyGrain);
    applyGrain(get('grain', true));
    applyAmbient(get('ambient', true));

    // ── Dynamic Island toggle ─────────────────────
    const tIsland = document.getElementById('t-island');
    if (tIsland) {
      tIsland.checked = get('island_on', true);
      tIsland.addEventListener('change', () => {
        set('island_on', tIsland.checked);
        applyIsland(tIsland.checked);
      });
    }
    applyIsland(get('island_on', true));

    // ── musican® toggle ───────────────────────────
    const tMusican = document.getElementById('t-musican');
    if (tMusican) {
      tMusican.checked = get('musican_on', true);
      tMusican.addEventListener('change', () => {
        set('musican_on', tMusican.checked);
        if (!tMusican.checked) Visualizer?.hide?.();
        Visualizer?.setAutoShow?.(tMusican.checked && get('viz_auto', true));
        ['btn-musican', 'pb-viz-btn'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = tMusican.checked ? '' : 'none';
        });
      });
    }
    if (!get('musican_on', true)) {
      ['btn-musican', 'pb-viz-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }

    // ── musican® mode ─────────────────────────────
    const modeSel = document.getElementById('musican-mode-sel');
    if (modeSel) {
      const savedMode = localStorage.getItem('ms_musican_mode') || 'visualizer';
      modeSel.value = savedMode;
      Visualizer?.setMode?.(savedMode);
      modeSel.addEventListener('change', () => {
        localStorage.setItem('ms_musican_mode', modeSel.value);
        Visualizer?.setMode?.(modeSel.value);
      });
    }

    // ── Viz auto-show + timeout ───────────────────
    syncToggle('t-viz-auto', 'viz_auto', true, v => {
      Visualizer?.setAutoShow?.(v && get('musican_on', true));
    });
    Visualizer?.setAutoShow?.(get('viz_auto', true) && get('musican_on', true));

    const vtR = document.getElementById('viz-timeout-r');
    const vtL = document.getElementById('viz-timeout-lbl');
    if (vtR) {
      vtR.value = get('viz_timeout', 5);
      if (vtL) vtL.textContent = `${vtR.value}s`;
      vtR.addEventListener('input', () => {
        if (vtL) vtL.textContent = `${vtR.value}s`;
        set('viz_timeout', parseInt(vtR.value));
        Visualizer?.setTimeout_?.(parseInt(vtR.value));
      });
    }
    Visualizer?.setTimeout_?.(get('viz_timeout', 5));

    // ── Viz color mode ────────────────────────────
    const vcm = document.getElementById('viz-color-mode');
    const vcf = document.getElementById('viz-fixed-color');
    if (vcm) {
      vcm.value = get('viz_color_mode', 'dynamic');
      if (vcf) vcf.value = get('viz_fixed_color', '#1db954');
      Visualizer?.setColorMode?.(vcm.value, vcf?.value);
      vcm.addEventListener('change', () => {
        set('viz_color_mode', vcm.value);
        Visualizer?.setColorMode?.(vcm.value, vcf?.value);
      });
      vcf?.addEventListener('input', () => {
        set('viz_fixed_color', vcf.value);
        Visualizer?.setColorMode?.(vcm.value, vcf.value);
      });
    }

    // ── Lyrics toggle ─────────────────────────────
    syncToggle('t-lyrics', 'lyrics_on', true, v => {
      const right = document.getElementById('np-right');
      const layout = document.getElementById('np-layout');
      if (right) right.style.display = v ? '' : 'none';
      if (layout) layout.classList.toggle('lyrics-off', !v);
    });

    // ── Home widgets ──────────────────────────────
    ['quick','bento','discover','daily','toptracks','topartists','newreleases','recent'].forEach(k => {
      const el = document.getElementById(`hw-${k}`);
      if (!el) return;
      el.checked = get(`hw_${k}`, true);
      el.addEventListener('change', () => { set(`hw_${k}`, el.checked); HomeView?.render?.(); });
    });

    // ── Player bar on/off toggle ─────────────────
    const tPb = document.getElementById('t-playerbar');
    if (tPb) {
      tPb.checked = !get('pb_hidden', false);
      tPb.addEventListener('change', () => {
        const hidden = !tPb.checked;
        set('pb_hidden', hidden);
        document.body.classList.toggle('pb-hidden', hidden);
        const pb = document.getElementById('player-bar');
        if (pb) pb.style.display = hidden ? 'none' : 'flex';
      });
    }
    if (get('pb_hidden', false)) {
      document.body.classList.add('pb-hidden');
      const pb = document.getElementById('player-bar');
      if (pb) pb.style.display = 'none';
    }

    // ── Player bar element toggles ────────────────
    applyPlayerBarToggles();
    const pbToggles = [
      ['pb-like-t',    'pb_like',    true],
      ['pb-shuf-t',    'pb_shuf',    true],
      ['pb-vol-t',     'pb_vol',     true],
      ['pb-miniviz-t', 'pb_miniviz', true],
      ['pb-lyr-t',     'pb_lyr',     true],
      ['pb-time-t',    'pb_time',    true],
    ];
    pbToggles.forEach(([id, key, def]) => {
      syncToggle(id, key, def, () => applyPlayerBarToggles());
    });

    // ── EQ ────────────────────────────────────────
    AudioEngine?.initUI?.();

    // ── Panel open/close ──────────────────────────
    document.getElementById('btn-customize')?.addEventListener('click', () =>
      document.getElementById('customize-panel').classList.toggle('open')
    );
    document.getElementById('customize-close')?.addEventListener('click', () =>
      document.getElementById('customize-panel').classList.remove('open')
    );
    document.getElementById('home-customize-btn')?.addEventListener('click', () =>
      document.getElementById('customize-panel').classList.add('open')
    );

    // ── Titlebar double-click toggle ──────────────
    document.getElementById('titlebar')?.addEventListener('dblclick', e => {
      if (e.target.closest('#island,#tb-right,#fallback-nav')) return;
      const hidden = !document.body.classList.contains('titlebar-hidden');
      document.body.classList.toggle('titlebar-hidden', hidden);
      set('titlebar_hidden', hidden);
      App.toast(hidden ? 'Titlebar hidden — double-click top to restore' : 'Titlebar restored', 'info');
    });
    // Also restore by double-clicking very top of screen when hidden
    document.addEventListener('dblclick', e => {
      if (!document.body.classList.contains('titlebar-hidden')) return;
      if (e.clientY < 16) {
        document.body.classList.remove('titlebar-hidden');
        set('titlebar_hidden', false);
      }
    });
    if (get('titlebar_hidden', false)) document.body.classList.add('titlebar-hidden');

    // ── Player bar toggle ─────────────────────────
    const pbHidden = get('pb_hidden', false);
    if (pbHidden) {
      document.body.classList.add('pb-hidden');
      document.getElementById('player-bar').style.display = 'none';
    }
  }

  return { init, get, getPref, set, applyAccent, applyPbStyle, applyIsland, applyPlayerBarToggles, applyHomeLayout };
})();
