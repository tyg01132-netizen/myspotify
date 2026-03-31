/* visualizer.js — myspotify musican® */
const Visualizer = (() => {
  let _canvas, _ctx;
  let _miniCanvas, _miniCtx;
  let _animId = null;
  let _visible = false;
  let _autoShow = true;
  let _timeout = 5;
  let _lastActivity = Date.now();
  let _mode = 'visualizer'; // 'visualizer' | 'lyrics'
  let _colorMode = 'dynamic';
  let _fixedColor = '#1db954';
  let _bpm = 120;
  let _energy = 0.6;
  let _smoothed = new Array(80).fill(0);
  let _beatPulse = 0;
  let _prevBass = 0;
  let _lastBeatTime = 0;
  let _lyricLines = []; // shared lyrics for musican lyrics mode
  let _lyricLastIdx = -1;

  function isPlaying() { return document.body.classList.contains('playing'); }

  function getColor(a = 1) {
    if (_colorMode === 'fixed') {
      const r = parseInt(_fixedColor.slice(1, 3), 16);
      const g = parseInt(_fixedColor.slice(3, 5), 16);
      const b = parseInt(_fixedColor.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    const s = document.documentElement.style;
    const cs = getComputedStyle(document.documentElement);
    const r = parseFloat(s.getPropertyValue('--ar') || cs.getPropertyValue('--ar')) || 29;
    const g = parseFloat(s.getPropertyValue('--ag') || cs.getPropertyValue('--ag')) || 185;
    const b = parseFloat(s.getPropertyValue('--ab') || cs.getPropertyValue('--ab')) || 84;
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  }

  function init() {
    _canvas = document.getElementById('musican-canvas');
    _ctx    = _canvas ? _canvas.getContext('2d') : null;
    _miniCanvas = document.getElementById('mini-viz-c');
    _miniCtx    = _miniCanvas ? _miniCanvas.getContext('2d') : null;

    if (_canvas) {
      resize();
      window.addEventListener('resize', resize);
    }

    // Track user activity — keyboard, mouse, touch
    document.addEventListener('keydown',    onActivity, true);
    document.addEventListener('mousemove',  onActivity, true);
    document.addEventListener('touchstart', onActivity, true);

    // Check idle every second
    setInterval(checkIdle, 1000);

    // Click anywhere on musican to dismiss
    document.getElementById('musican')?.addEventListener('click', e => {
      // Don't dismiss if clicking the mode button
      if (e.target.id === 'musican-mode-btn') return;
      hide();
      _lastActivity = Date.now();
    });

    // Mode toggle button
    document.getElementById('musican-mode-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      toggleMode();
    });

    // Mini viz
    drawMini();
  }

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
    // Update content
    _updateMusicanContent();
    // Set mode class
    el.classList.toggle('mode-lyrics', _mode === 'lyrics');
    // Update mode button label
    const modeBtn = document.getElementById('musican-mode-btn');
    if (modeBtn) modeBtn.textContent = _mode === 'lyrics' ? '🎵 Visualizer' : '🎤 Lyrics';
    // Fetch lyrics for lyrics mode
    if (_mode === 'lyrics') _loadMusicanLyrics();
    // Resize canvas
    resize();
    document.getElementById('btn-musican')?.classList.add('on');
    document.getElementById('pb-viz-btn')?.classList.add('on');
    startDraw();
  }

  function hide() {
    if (!_visible) return;
    _visible = false;
    const el = document.getElementById('musican');
    if (!el) return;
    el.classList.add('closing');
    el.addEventListener('animationend', () => {
      el.style.display = 'none';
      el.classList.remove('closing');
    }, { once: true });
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    document.getElementById('btn-musican')?.classList.remove('on');
    document.getElementById('pb-viz-btn')?.classList.remove('on');
  }

  function toggle() {
    if (_visible) { hide(); _lastActivity = Date.now(); }
    else show();
  }

  function toggleMode() {
    _mode = _mode === 'visualizer' ? 'lyrics' : 'visualizer';
    localStorage.setItem('ms_musican_mode', _mode);
    const el = document.getElementById('musican');
    if (el) {
      el.classList.toggle('mode-lyrics', _mode === 'lyrics');
    }
    const modeBtn = document.getElementById('musican-mode-btn');
    if (modeBtn) modeBtn.textContent = _mode === 'lyrics' ? '🎵 Visualizer' : '🎤 Lyrics';
    if (_mode === 'lyrics') _loadMusicanLyrics();
  }

  function _updateMusicanContent() {
    const pbArt    = document.getElementById('pb-art')?.src;
    const pbName   = document.getElementById('pb-name')?.textContent || '';
    const pbArtist = document.getElementById('pb-artist')?.textContent || '';
    const musicanArt = document.getElementById('musican-art');
    const musicanBg  = document.getElementById('musican-bg');
    const musicanName   = document.getElementById('musican-name');
    const musicanArtist = document.getElementById('musican-artist');
    if (pbArt && musicanArt) musicanArt.src = pbArt;
    if (pbArt && musicanBg)  musicanBg.style.backgroundImage = `url(${pbArt})`;
    if (musicanName)   musicanName.textContent   = pbName;
    if (musicanArtist) musicanArtist.textContent = pbArtist;
  }

  async function _loadMusicanLyrics() {
    const lyricsEl = document.getElementById('musican-lyrics');
    if (!lyricsEl) return;
    lyricsEl.innerHTML = `<div class="ld"><span></span><span></span><span></span></div>`;
    _lyricLines = [];
    _lyricLastIdx = -1;

    // Try to copy already-loaded lyrics from NP view first (instant)
    const npLines = document.querySelectorAll('#np-lyrics .ly-line');
    if (npLines.length > 0) {
      lyricsEl.innerHTML = Array.from(npLines).map(l => l.outerHTML).join('');
      _lyricLines = Array.from(lyricsEl.querySelectorAll('.ly-line'));
      _attachMusicanLyricClicks();
      return;
    }

    // Otherwise fetch independently from lrclib
    const pbName   = document.getElementById('pb-name')?.textContent || '';
    const pbArtist = document.getElementById('pb-artist')?.textContent || '';
    if (!pbName) { lyricsEl.innerHTML = '<div class="ly-line" style="opacity:.4">No track playing</div>'; return; }

    function clean(s) {
      return s.replace(/[®™©]/g,'').replace(/\s*[\(\[][^\)\]]*[\)\]]/g,' ').replace(/\s+/g,' ').trim();
    }
    const queries = [
      `${pbName} ${pbArtist}`,
      `${clean(pbName)} ${pbArtist}`,
      `${clean(pbName)} ${clean(pbArtist)}`,
      clean(pbName),
    ];

    let match = null;
    for (const q of queries) {
      try {
        const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) continue;
        const list = await res.json();
        if (!list?.length) continue;
        match = list.find(x => x.syncedLyrics && x.artistName?.toLowerCase().includes(clean(pbArtist).toLowerCase()))
             || list.find(x => x.syncedLyrics)
             || list.find(x => x.plainLyrics);
        if (match) break;
      } catch {}
    }

    if (!match) {
      lyricsEl.innerHTML = '<div class="ly-line" style="opacity:.4;font-size:16px">No lyrics found</div>';
      return;
    }

    let parsed = [];
    if (match.syncedLyrics) {
      parsed = match.syncedLyrics.split('\n').map(line => {
        const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
        if (!m) return null;
        return { ms: (parseInt(m[1])*60 + parseFloat(m[2]))*1000, text: m[3].trim() };
      }).filter(Boolean);
      lyricsEl.innerHTML = parsed.map((l,i)=>
        `<div class="ly-line" data-ms="${l.ms}" data-i="${i}">${l.text||'&nbsp;'}</div>`
      ).join('');
    } else {
      parsed = match.plainLyrics.split('\n').map((text,i)=>({ ms:0, text }));
      lyricsEl.innerHTML = parsed.map((l,i)=>
        `<div class="ly-line" data-i="${i}">${l.text||'&nbsp;'}</div>`
      ).join('');
    }

    _lyricLines = Array.from(lyricsEl.querySelectorAll('.ly-line'));
    _attachMusicanLyricClicks();
  }

  function _attachMusicanLyricClicks() {
    _lyricLines.forEach((el, i) => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const ms = parseInt(el.dataset.ms);
        if (ms) { API.seek(ms); }
      });
    });
  }

  function syncMusicanLyrics(pos) {
    if (_mode !== 'lyrics' || !_lyricLines.length || !_visible) return;
    // Find active line by ms timestamp
    let idx = 0;
    for (let i = 0; i < _lyricLines.length; i++) {
      const ms = parseInt(_lyricLines[i].dataset.ms || 0);
      if (ms > 0 && ms <= pos) idx = i;
      else if (ms > pos) break;
    }
    if (idx === _lyricLastIdx) return;
    _lyricLastIdx = idx;
    _lyricLines.forEach((l, i) => l.classList.toggle('active', i === idx));
    const active = _lyricLines[idx];
    const container = document.getElementById('musican-lyrics');
    if (active && container) {
      container.scrollTo({ top: active.offsetTop - container.offsetHeight / 2 + active.offsetHeight / 2, behavior: 'smooth' });
    }
  }

  function setAutoShow(v) { _autoShow = !!v; }
  function setTimeout_(s) { _timeout = Math.max(1, parseInt(s)); }
  function setColorMode(mode, hex) { _colorMode = mode; if (hex) _fixedColor = hex; }
  function setMode(m) { _mode = m; }
  function setTrackInfo(bpm, energy) {
    _bpm    = Math.max(40, Math.min(220, bpm || 120));
    _energy = Math.max(0.1, Math.min(1, energy || 0.6));
  }

  function updateArt(url, name, artist) {
    const musicanArt    = document.getElementById('musican-art');
    const musicanBg     = document.getElementById('musican-bg');
    const musicanName   = document.getElementById('musican-name');
    const musicanArtist = document.getElementById('musican-artist');
    if (url && musicanArt) musicanArt.src = url;
    if (url && musicanBg)  musicanBg.style.backgroundImage = `url(${url})`;
    if (name && musicanName)     musicanName.textContent   = name;
    if (artist && musicanArtist) musicanArtist.textContent = artist;
  }

  function getFreqData() {
    const a = AudioEngine?.getAnalyser?.();
    if (!a || !AudioEngine?.isConnected?.()) return null;
    const d = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(d);
    return d;
  }

  function getRaw(freqData, N) {
    const out = new Array(N);
    const playing = isPlaying();
    for (let i = 0; i < N; i++) {
      if (freqData) {
        // Logarithmic frequency mapping
        const start = Math.floor(Math.pow(i / N, 1.7) * freqData.length * 0.7);
        const end   = Math.floor(Math.pow((i + 1) / N, 1.7) * freqData.length * 0.7);
        let sum = 0, cnt = Math.max(1, end - start);
        for (let j = start; j < end; j++) sum += freqData[j];
        out[i] = (sum / cnt) / 255;
      } else if (playing) {
        // BPM-based simulation
        const t = performance.now() / 1000;
        const bf = _bpm / 60;
        const x = i / N;
        const bassW = Math.max(0, 1 - x * 3);
        const midW  = Math.max(0, 1 - Math.abs(x - 0.35) * 4);
        const trebW = Math.max(0, (x - 0.65) * 3);
        const beat   = Math.max(0, Math.sin(t * bf * Math.PI * 2)) * bassW * _beatPulse;
        const melody = (Math.sin(t * bf * 1.5 * Math.PI * 2 + x * 8) * .5 + .5) * midW;
        const treble = (Math.sin(t * bf * 3.5 * Math.PI * 2 + x * 16) * .5 + .5) * trebW;
        out[i] = (beat * 0.55 + melody * 0.3 + treble * 0.15) * _energy;
      } else {
        out[i] = 0; // stopped
      }
    }
    return out;
  }

  function detectBeat(bass) {
    const now = performance.now();
    if (bass > _prevBass * 1.3 && bass > 0.35 && now - _lastBeatTime > (60000 / _bpm) * 0.38) {
      _beatPulse = 1.0;
      _lastBeatTime = now;
    }
    _prevBass = bass;
    _beatPulse *= (isPlaying() ? 0.88 : 0.6);
  }

  function startDraw() {
    const N = 80;
    const draw = () => {
      if (!_visible || !_canvas || !_ctx) return;
      _animId = requestAnimationFrame(draw);

      const W = _canvas.width, H = _canvas.height;
      const freqData = getFreqData();
      const raw = getRaw(freqData, N);

      // Smooth
      const playing = isPlaying();
      for (let i = 0; i < N; i++) {
        const a = playing ? 0.28 : 0.06; // fast attack when playing, slow decay when paused
        _smoothed[i] = _smoothed[i] * (1 - a) + raw[i] * a;
      }

      const bass = _smoothed.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
      detectBeat(bass);

      _ctx.clearRect(0, 0, W, H);

      // Beat glow
      if (_beatPulse > 0.05) {
        const r = _beatPulse * Math.min(W, H) * 0.45;
        const g = _ctx.createRadialGradient(W / 2, H, 0, W / 2, H, r);
        g.addColorStop(0, getColor(_beatPulse * 0.07));
        g.addColorStop(1, 'transparent');
        _ctx.fillStyle = g;
        _ctx.fillRect(0, 0, W, H);
      }

      if (_mode === 'visualizer') {
        const barW = W / N;
        for (let i = 0; i < N; i++) {
          const h = Math.max(1, _smoothed[i] * H * 0.74 * (1 + _beatPulse * 0.3));
          const x = i * barW;
          const grad = _ctx.createLinearGradient(x, H, x, H - h);
          grad.addColorStop(0, getColor(0.9));
          grad.addColorStop(0.5, getColor(0.55));
          grad.addColorStop(1, getColor(0.05));
          _ctx.fillStyle = grad;
          _ctx.fillRect(x + barW * 0.08, H - h, barW * 0.84, h);
          // Bright cap on tall bars
          if (h > H * 0.3 && playing) {
            _ctx.fillStyle = getColor(0.8);
            _ctx.fillRect(x + barW * 0.08, H - h - 2, barW * 0.84, 2);
          }
        }
        // Reflection
        _ctx.save();
        _ctx.globalAlpha = 0.2;
        _ctx.scale(1, -1);
        _ctx.translate(0, -H * 2);
        for (let i = 0; i < N; i++) {
          const h = Math.max(1, _smoothed[i] * H * 0.2);
          const x = i * (W / N);
          const grad = _ctx.createLinearGradient(x, H, x, H - h);
          grad.addColorStop(0, getColor(0.5));
          grad.addColorStop(1, 'transparent');
          _ctx.fillStyle = grad;
          _ctx.fillRect(x + (W/N)*0.08, H-h, (W/N)*0.84, h);
        }
        _ctx.restore();
      }
    };
    _animId = requestAnimationFrame(draw);
  }

  // Mini visualizer in player bar
  function drawMini() {
    const canvas = _miniCanvas, ctx = _miniCtx;
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height, N = 5;
    const sm = new Array(N).fill(0);

    const draw = () => {
      requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      if (!isPlaying()) return;
      const freqData = getFreqData();
      for (let i = 0; i < N; i++) {
        let raw = 0;
        if (freqData) {
          const idx = Math.floor(i / N * freqData.length * 0.5);
          raw = freqData[idx] / 255;
        } else {
          const t = performance.now() / 1000;
          raw = (Math.sin(t * (_bpm / 60) * Math.PI * 2 + i * 1.1) * 0.5 + 0.5) * _energy;
        }
        sm[i] = sm[i] * 0.65 + raw * 0.35;
        const h = Math.max(2, sm[i] * H);
        const x = i * (W / N);
        const bw = W / N - 1;
        const grad = ctx.createLinearGradient(x, H, x, 0);
        grad.addColorStop(0, getColor(0.9));
        grad.addColorStop(1, getColor(0.2));
        ctx.fillStyle = grad;
        ctx.fillRect(x, H - h, bw, h);
      }
    };
    draw();
  }

  return {
    init, show, hide, toggle,
    setAutoShow, setTimeout_, setColorMode, setMode, setTrackInfo, updateArt,
    syncMusicanLyrics,
    get visible() { return _visible; },
  };
})();
