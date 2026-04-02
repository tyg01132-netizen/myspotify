/* visualizer.js — myspotify musican® — detailed FFT visualizer */
const Visualizer = (() => {
  let _canvas, _ctx, _miniCanvas, _miniCtx;
  let _animId = null, _miniAnimId = null;
  let _visible = false;
  let _autoShow = true;
  let _timeout = 5;
  let _lastActivity = Date.now();
  let _colorMode = 'dynamic';
  let _fixedColor = '#1db954';
  let _bpm = 120, _energy = 0.6;
  let _beatPulse = 0, _prevBass = 0, _lastBeatTime = 0;

  // High resolution smoothed bands
  const N_BARS = 128;
  let _smoothed    = new Float32Array(N_BARS);
  let _peak        = new Float32Array(N_BARS);  // peak hold
  let _peakDecay   = new Float32Array(N_BARS);

  function isPlaying() { return document.body.classList.contains('playing'); }

  function getColor(a = 1) {
    if (_colorMode === 'fixed') {
      const r=parseInt(_fixedColor.slice(1,3),16), g=parseInt(_fixedColor.slice(3,5),16), b=parseInt(_fixedColor.slice(5,7),16);
      return `rgba(${r},${g},${b},${a})`;
    }
    const st = document.documentElement.style, cs = getComputedStyle(document.documentElement);
    const r = parseFloat(st.getPropertyValue('--ar') || cs.getPropertyValue('--ar')) || 29;
    const g = parseFloat(st.getPropertyValue('--ag') || cs.getPropertyValue('--ag')) || 185;
    const b = parseFloat(st.getPropertyValue('--ab') || cs.getPropertyValue('--ab')) || 84;
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  }

  function getAnalyserData() {
    const a = AudioEngine?.getAnalyser?.();
    if (!a || !AudioEngine?.isConnected?.()) return null;
    const d = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(d);
    return d;
  }

  function getRawBands(freqData) {
    const out = new Float32Array(N_BARS);
    const playing = isPlaying();
    for (let i = 0; i < N_BARS; i++) {
      if (freqData) {
        // Logarithmic mapping — more detail in bass/mid, less in treble
        const t1 = Math.pow(i / N_BARS, 2.2);
        const t2 = Math.pow((i+1) / N_BARS, 2.2);
        const start = Math.floor(t1 * freqData.length * 0.75);
        const end   = Math.floor(t2 * freqData.length * 0.75);
        let sum = 0, n = Math.max(1, end - start);
        for (let j = start; j < end; j++) sum += freqData[j];
        out[i] = (sum / n) / 255;
      } else if (playing) {
        // Smooth simulation when no analyser connected
        const t = performance.now() / 1000;
        const x = i / N_BARS;
        const bf = _bpm / 60;
        const bass  = Math.max(0, 1-x*3)   * Math.max(0, Math.sin(t*bf*Math.PI*2))     * _beatPulse;
        const mid   = Math.max(0, 1-Math.abs(x-.35)*5) * (Math.sin(t*bf*1.7*Math.PI*2+x*9)*.5+.5);
        const hi    = Math.max(0, (x-.6)*2.5) * (Math.sin(t*bf*4*Math.PI*2+x*18)*.5+.5);
        out[i] = (bass*.5 + mid*.32 + hi*.18) * _energy;
      }
    }
    return out;
  }

  function detectBeat(bass) {
    const now = performance.now();
    const interval = 60000 / _bpm;
    if (bass > _prevBass * 1.28 && bass > 0.3 && now - _lastBeatTime > interval * 0.4) {
      _beatPulse = 1.0; _lastBeatTime = now;
    }
    _prevBass = bass;
    _beatPulse *= isPlaying() ? 0.87 : 0.5;
  }

  function init() {
    _canvas     = document.getElementById('musican-canvas');
    _ctx        = _canvas?.getContext('2d') ?? null;
    _miniCanvas = document.getElementById('mini-viz-c');
    _miniCtx    = _miniCanvas?.getContext('2d') ?? null;

    if (_canvas) { resize(); window.addEventListener('resize', resize); }

    // Activity tracking
    ['keydown','mousemove','touchstart'].forEach(ev =>
      document.addEventListener(ev, onActivity, { passive: true, capture: true })
    );
    setInterval(checkIdle, 1000);

    // Dismiss musican on click
    document.getElementById('musican')?.addEventListener('click', e => {
      hide(); _lastActivity = Date.now();
    });

    // Restore saved mode
    const savedMode = localStorage.getItem('ms_musican_mode');
    if (savedMode) _mode = savedMode;

    startMini();
  }

  let _mode = 'visualizer';

  function onActivity() {
    _lastActivity = Date.now();
    if (_visible) hide();
  }

  function resize() {
    if (!_canvas) return;
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight;
  }

  function checkIdle() {
    if (!_autoShow || _visible || !isPlaying()) return;
    if ((Date.now() - _lastActivity) / 1000 >= _timeout) show();
  }

  function show() {
    if (_visible) return;
    _visible = true;
    const el = document.getElementById('musican');
    if (!el) return;
    el.classList.remove('closing');
    el.style.display = 'block';
    // Resume audio context (needed for Chrome autoplay policy)
    AudioEngine?.resume?.();
    _updateContent();
    resize();
    document.body.classList.add('musican-open');
    document.getElementById('btn-musican')?.classList.add('on');
    document.getElementById('pb-viz-btn')?.classList.add('on');
    if (_animId) cancelAnimationFrame(_animId);
    drawMain();
  }

  function hide() {
    if (!_visible) return;
    _visible = false;
    const el = document.getElementById('musican');
    if (!el) return;
    el.classList.add('closing');
    el.addEventListener('animationend', () => {
      el.style.display = 'none'; el.classList.remove('closing');
    }, { once: true });
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    document.body.classList.remove('musican-open');
    document.getElementById('btn-musican')?.classList.remove('on');
    document.getElementById('pb-viz-btn')?.classList.remove('on');
  }

  function toggle() {
    if (_visible) { hide(); _lastActivity = Date.now(); }
    else show();
  }

  function _updateContent() {
    const art    = document.getElementById('pb-art')?.src || '';
    const name   = document.getElementById('pb-name')?.textContent || '';
    const artist = document.getElementById('pb-artist')?.textContent || '';
    const mArt   = document.getElementById('musican-art');
    const mBg    = document.getElementById('musican-bg');
    const mName  = document.getElementById('musican-name');
    const mArtist= document.getElementById('musican-artist');
    if (art && mArt)    mArt.src = art;
    if (art && mBg)     mBg.style.backgroundImage = `url(${art})`;
    if (name && mName)  mName.textContent  = name;
    if (artist && mArtist) mArtist.textContent = artist;
  }

  // ── Main visualizer draw ────────────────────────
  function drawMain() {
    if (!_visible || !_canvas || !_ctx) return;
    _animId = requestAnimationFrame(drawMain);

    const W = _canvas.width, H = _canvas.height;
    const freqData = getAnalyserData();
    const raw      = getRawBands(freqData);
    const playing  = isPlaying();

    // Smooth with different attack/release
    const ATTACK  = playing ? 0.35 : 0.08;
    const RELEASE = playing ? 0.70 : 0.92;
    for (let i = 0; i < N_BARS; i++) {
      _smoothed[i] = raw[i] > _smoothed[i]
        ? _smoothed[i] * (1-ATTACK)  + raw[i] * ATTACK
        : _smoothed[i] * (1-RELEASE) + raw[i] * RELEASE;
    }

    const bass = _smoothed.slice(0, 12).reduce((a,b)=>a+b, 0) / 12;
    if (playing) detectBeat(bass);

    _ctx.clearRect(0, 0, W, H);

    // Beat glow
    if (_beatPulse > 0.05 && playing) {
      const gx = _ctx.createRadialGradient(W/2, H, 0, W/2, H, _beatPulse * W * 0.5);
      gx.addColorStop(0, getColor(_beatPulse * 0.09));
      gx.addColorStop(1, 'transparent');
      _ctx.fillStyle = gx;
      _ctx.fillRect(0, 0, W, H);
    }

    const barW  = W / N_BARS;
    const bw    = barW * 0.75;
    const gap   = barW * 0.25;

    for (let i = 0; i < N_BARS; i++) {
      const v = _smoothed[i];
      const h = Math.max(2, v * H * 0.78 * (1 + _beatPulse * 0.25));
      const x = i * barW + gap * 0.5;
      const y = H - h;

      // Multi-stop gradient per bar: accent at bottom, white-ish at top
      const grad = _ctx.createLinearGradient(x, H, x, H - h);
      grad.addColorStop(0,   getColor(1.0));
      grad.addColorStop(0.4, getColor(0.80));
      grad.addColorStop(0.75,getColor(0.45));
      grad.addColorStop(1,   getColor(0.12));
      _ctx.fillStyle = grad;
      _ctx.fillRect(x, y, bw, h);

      // Bright highlight on top of tall bars
      if (v > 0.4 && playing) {
        _ctx.fillStyle = getColor(v * 0.9);
        _ctx.fillRect(x, y, bw, 2);
      }

      // Peak hold dots
      _peakDecay[i] = (_peakDecay[i] ?? 0);
      if (h > _peak[i]) {
        _peak[i] = h;
        _peakDecay[i] = 0;
      } else {
        _peakDecay[i] += 0.4;
        _peak[i] = Math.max(2, _peak[i] - _peakDecay[i] * 0.3);
      }
      if (_peak[i] > 4 && playing) {
        _ctx.fillStyle = getColor(0.65);
        _ctx.fillRect(x, H - _peak[i] - 2, bw, 2);
      }
    }

    // Reflection (bottom mirror)
    _ctx.save();
    _ctx.globalAlpha = 0.18;
    _ctx.scale(1, -1);
    _ctx.translate(0, -H * 2);
    for (let i = 0; i < N_BARS; i++) {
      const v = _smoothed[i];
      const h = Math.max(1, v * H * 0.18);
      const x = i * barW + gap * 0.5;
      const grad = _ctx.createLinearGradient(x, H, x, H-h);
      grad.addColorStop(0, getColor(0.6));
      grad.addColorStop(1, 'transparent');
      _ctx.fillStyle = grad;
      _ctx.fillRect(x, H-h, bw, h);
    }
    _ctx.restore();
  }

  // ── Mini visualizer (player bar) ───────────────
  function startMini() {
    const canvas = _miniCanvas, ctx = _miniCtx;
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    const N = 6;
    const sm = new Float32Array(N);

    const draw = () => {
      requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      const miniEl = document.getElementById('pb-mini-viz');
      if (!miniEl?.classList.contains('show')) return;
      if (!isPlaying()) return;

      const freqData = getAnalyserData();
      for (let i = 0; i < N; i++) {
        let raw = 0;
        if (freqData) {
          const idx = Math.floor(Math.pow(i/N, 1.5) * freqData.length * 0.6);
          raw = freqData[idx] / 255;
        } else {
          const t = performance.now()/1000, bf = _bpm/60;
          raw = (Math.sin(t*bf*Math.PI*2 + i*1.1)*0.5+0.5) * _energy;
        }
        sm[i] = raw > sm[i] ? sm[i]*0.6+raw*0.4 : sm[i]*0.75+raw*0.25;
        const h = Math.max(2, sm[i] * H * 0.9);
        const bw = Math.floor((W/N) - 1.5);
        const x  = i * (W/N);
        const gr = ctx.createLinearGradient(x, H, x, 0);
        gr.addColorStop(0, getColor(0.95));
        gr.addColorStop(1, getColor(0.3));
        ctx.fillStyle = gr;
        ctx.fillRect(x, H-h, bw, h);
      }
    };
    draw();
  }

  function setAutoShow(v)         { _autoShow = !!v; }
  function setTimeout_(s)         { _timeout = Math.max(1, parseInt(s)); }
  function setColorMode(mode, hex){ _colorMode = mode; if (hex) _fixedColor = hex; }
  function setTrackInfo(bpm, e)   { _bpm = bpm || 120; _energy = e || 0.6; }
  function updateArt(url, name, artist) {
    const mArt = document.getElementById('musican-art');
    const mBg  = document.getElementById('musican-bg');
    const mN   = document.getElementById('musican-name');
    const mA   = document.getElementById('musican-artist');
    if (url && mArt) mArt.src = url;
    if (url && mBg)  mBg.style.backgroundImage = `url(${url})`;
    if (name   && mN) mN.textContent = name;
    if (artist && mA) mA.textContent = artist;
  }

  return {
    init, show, hide, toggle,
    setAutoShow, setTimeout_, setColorMode, setTrackInfo, updateArt,
    get visible() { return _visible; },
  };
})();
