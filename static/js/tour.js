/* tour.js — live tour with spotlight on actual elements */
const Tour = (() => {
  let _step = 0;
  let _raf = null;

  const STEPS = [
    {
      icon: '🎵',
      title: 'Welcome to myspotify musican®',
      body: 'Your personal Spotify client. Let\'s take a 60-second tour. Click Next to start.',
      target: null, // no spotlight
      view: null,
      pos: 'center',
    },
    {
      icon: '💊',
      title: 'The Dynamic Island',
      body: 'This pill at the top is your navigation hub. Click it when music is playing to expand it — it shows controls, track info, and all nav links.',
      target: '#island',
      view: 'home',
      pos: 'below',
    },
    {
      icon: '🏠',
      title: 'Home View',
      body: 'Your home screen shows quick play shortcuts, a bento grid of recent music, Discover Weekly, Daily Mixes, and your top tracks. Three layout options available in Customize.',
      target: '#view-home .home-header',
      view: 'home',
      pos: 'below',
    },
    {
      icon: '🔍',
      title: 'Search',
      body: 'Tap Search in the island or press ⌘F to search for any song, artist, or album. Results appear inline.',
      target: '#search-bar-outer',
      view: 'search',
      pos: 'below',
    },
    {
      icon: '📚',
      title: 'Your Library',
      body: 'All your playlists, saved albums, and followed artists live here. Filter, sort, and create new playlists.',
      target: '#lib-seg',
      view: 'library',
      pos: 'below',
    },
    {
      icon: '🎹',
      title: 'Now Playing',
      body: 'See full track info, audio features (BPM, key, energy), and synced lyrics. Toggle lyrics on/off, or open them fullscreen with ⌘L.',
      target: '.np-art-wrap',
      view: 'nowplaying',
      pos: 'right',
    },
    {
      icon: '🌊',
      title: 'myspotify musican®',
      body: 'After 5 seconds of inactivity (while music plays), the musican® visualizer appears — bars that react to the beat. Switch between Visualizer and Lyrics modes.',
      target: '#btn-musican',
      view: null,
      pos: 'below',
    },
    {
      icon: '🎨',
      title: 'Customize Everything',
      body: 'Click the ✏ icon to open the Customize panel. Change accent colors, home layout, player bar style, and toggle any element on or off.',
      target: '#btn-customize',
      view: null,
      pos: 'below',
    },
    {
      icon: '⚙️',
      title: 'Settings',
      body: 'In Settings, configure your Spotify API credentials, EQ presets, musican® timeout, Dynamic Island toggle, and player bar elements.',
      target: '.sg-hd',
      view: 'settings',
      pos: 'below',
    },
    {
      icon: '✅',
      title: 'You\'re all set!',
      body: 'Press ? anytime for keyboard shortcuts, or click the Help button (?) to restart this tour. Your login is saved — no need to sign in again after restart.',
      target: '#btn-help',
      view: null,
      pos: 'below',
    },
  ];

  function init() {
    document.getElementById('tour-next')?.addEventListener('click', next);
    document.getElementById('tour-prev')?.addEventListener('click', prev);
    document.getElementById('tour-skip')?.addEventListener('click', done);
    document.getElementById('tour-bg')?.addEventListener('click', done);
    document.getElementById('btn-help')?.addEventListener('click', show);
    document.getElementById('s-tour-btn')?.addEventListener('click', () => { App.navigate('home'); setTimeout(show, 100); });

    // Auto-show first run
    if (!localStorage.getItem('ms_tour_done')) {
      setTimeout(show, 1800);
    }
  }

  function show() {
    _step = 0;
    const ov = document.getElementById('tour-overlay');
    if (!ov) return;
    ov.style.display = 'block';
    renderStep();
  }

  function done() {
    const ov = document.getElementById('tour-overlay');
    if (ov) ov.style.display = 'none';
    hidSpotlight();
    localStorage.setItem('ms_tour_done', '1');
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
  }

  function next() {
    _step++;
    if (_step >= STEPS.length) { done(); return; }
    renderStep();
  }

  function prev() {
    _step = Math.max(0, _step - 1);
    renderStep();
  }

  function renderStep() {
    const step = STEPS[_step];
    if (!step) { done(); return; }

    // Navigate if needed
    if (step.view) App.navigate(step.view);

    // Update card content
    const counter = document.getElementById('tour-counter');
    const icon    = document.getElementById('tour-icon');
    const title   = document.getElementById('tour-title');
    const body    = document.getElementById('tour-body');
    const prevBtn = document.getElementById('tour-prev');
    const nextBtn = document.getElementById('tour-next');
    const dots    = document.getElementById('tour-dots');

    if (counter) counter.textContent = `Step ${_step + 1} of ${STEPS.length}`;
    if (icon)  icon.textContent  = step.icon;
    if (title) title.textContent = step.title;
    if (body)  body.textContent  = step.body;
    if (prevBtn) prevBtn.style.display = _step > 0 ? 'block' : 'none';
    if (nextBtn) nextBtn.textContent   = _step === STEPS.length - 1 ? 'Finish ✓' : 'Next →';
    if (dots) {
      dots.innerHTML = STEPS.map((_, i) =>
        `<div class="tour-dot${i === _step ? ' active' : ''}"></div>`
      ).join('');
    }

    // Position spotlight + card
    if (step.target) {
      // Wait for view to render
      setTimeout(() => positionOnTarget(step), step.view ? 300 : 80);
    } else if (step.pos === 'center') {
      hidSpotlight();
      positionCardCenter();
    } else {
      hidSpotlight();
      positionCardCenter();
    }
  }

  function positionOnTarget(step) {
    const target = document.querySelector(step.target);
    if (!target) { hidSpotlight(); positionCardCenter(); return; }

    const rect = target.getBoundingClientRect();
    const pad = 8;
    const spotlight = document.getElementById('tour-spotlight');
    if (spotlight) {
      spotlight.style.display = 'block';
      spotlight.style.left   = `${rect.left - pad}px`;
      spotlight.style.top    = `${rect.top - pad}px`;
      spotlight.style.width  = `${rect.width + pad * 2}px`;
      spotlight.style.height = `${rect.height + pad * 2}px`;
    }

    // Position card near target
    const card = document.getElementById('tour-card');
    if (!card) return;
    const cw = 320, ch = 260;
    const margin = 14;
    let left, top;

    if (step.pos === 'below') {
      left = rect.left + rect.width / 2 - cw / 2;
      top  = rect.bottom + pad + margin;
    } else if (step.pos === 'right') {
      left = rect.right + margin;
      top  = rect.top + rect.height / 2 - ch / 2;
    } else if (step.pos === 'above') {
      left = rect.left + rect.width / 2 - cw / 2;
      top  = rect.top - ch - margin;
    } else {
      left = rect.left + rect.width / 2 - cw / 2;
      top  = rect.bottom + margin;
    }

    // Keep within viewport
    left = Math.max(12, Math.min(left, window.innerWidth  - cw - 12));
    top  = Math.max(12, Math.min(top,  window.innerHeight - ch - 12));

    card.style.left = `${left}px`;
    card.style.top  = `${top}px`;
  }

  function positionCardCenter() {
    const card = document.getElementById('tour-card');
    if (!card) return;
    const cw = 320, ch = 260;
    card.style.left = `${window.innerWidth  / 2 - cw / 2}px`;
    card.style.top  = `${window.innerHeight / 2 - ch / 2}px`;
  }

  function hidSpotlight() {
    const el = document.getElementById('tour-spotlight');
    if (el) el.style.display = 'none';
  }

  return { init, show, done };
})();
