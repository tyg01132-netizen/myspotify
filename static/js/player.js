/* player.js — myspotify musican® v2.5.2 */
const Player = (() => {
  let _sdk=null,_devId=null,_state=null;
  let _raf=null,_pos0=0,_t0=0,_playing=false;
  let _vol=0.8,_muted=false,_volBak=0.8,_barDrag=false;
  let _osdTimer=null;
  let _sleepMode=null,_sleepEnd=0,_sleepTick=null;
  let _lyrics=[],_lastLyricIdx=-1;
  let _lastTrackId=null;
  let _lyricsOn=true;
  let _lyricsFsOpen=false;

  const $=id=>document.getElementById(id);

  function init() {
    // ── Player bar ──────────────────────────────
    $('pb-play')?.addEventListener('click', togglePlay);
    $('pb-prev')?.addEventListener('click', sdkPrev);
    $('pb-next')?.addEventListener('click', sdkNext);
    $('pb-shuffle')?.addEventListener('click', toggleShuffle);
    $('pb-repeat')?.addEventListener('click', toggleRepeat);
    $('pb-like')?.addEventListener('click', toggleLike);
    $('pb-mute')?.addEventListener('click', toggleMute);
    $('pb-viz-btn')?.addEventListener('click', ()=>Visualizer.toggle());
    $('pb-lyrics-btn')?.addEventListener('click', openLyricsFs);
    $('pb-art-wrap')?.addEventListener('click', ()=>App.navigate('nowplaying'));
    $('pb-name')?.addEventListener('click', ()=>App.navigate('nowplaying'));
    $('pb-artist')?.addEventListener('click', ()=>{
      const a=_state?.track_window?.current_track?.artists;
      if(a?.[0]) App.navigate('artist', a[0].id);
    });
    initBar('pb-bar','pb-fill');
    initVolSlider('pb-vol-t','pb-vol-f', v=>setVol(v,true));
    $('player-bar')?.addEventListener('wheel', e=>{
      e.preventDefault(); setVol(_vol - e.deltaY*.002, true);
    }, {passive:false});

    // ── Now Playing ─────────────────────────────
    $('np-play')?.addEventListener('click', togglePlay);
    $('np-prev')?.addEventListener('click', sdkPrev);
    $('np-next')?.addEventListener('click', sdkNext);
    $('np-shuffle')?.addEventListener('click', toggleShuffle);
    $('np-repeat')?.addEventListener('click', toggleRepeat);
    $('np-like')?.addEventListener('click', toggleLike);
    $('np-radio')?.addEventListener('click', startRadio);
    $('np-add-pl')?.addEventListener('click', ()=>App.openAddToPlaylist());
    $('np-mute')?.addEventListener('click', toggleMute);
    $('np-artist-nm')?.addEventListener('click', ()=>{
      const a=_state?.track_window?.current_track?.artists;
      if(a?.[0]) App.navigate('artist', a[0].id);
    });
    $('np-lyrics-toggle')?.addEventListener('click', toggleLyricsPanel);
    $('np-lyrics-fs')?.addEventListener('click', openLyricsFs);
    initBar('np-bar','np-fill');
    initVolSlider('np-vol-t','np-vol-f', v=>setVol(v,true));

    // ── Dynamic Island buttons ───────────────────
    // Critical: use mousedown/touchstart instead of click to beat stopPropagation
    // And attach via capturing on the island, checking target
    const isl = $('island');
    if (isl) {
      isl.addEventListener('click', function(e) {
        e.stopPropagation();
        const btn = e.target.closest('.isl-btn, .isl-play-btn, .isl-nav-btn');
        if (btn) {
          switch(btn.id) {
            case 'isl-play':    togglePlay();    break;
            case 'isl-prev':    sdkPrev();       break;
            case 'isl-next':    sdkNext();       break;
            case 'isl-shuffle': toggleShuffle(); break;
            case 'isl-repeat':  toggleRepeat();  break;
            case 'nav-queue':   QueueComp?.toggle(); break;
          }
          if (btn.dataset.view) {
            App.navigate(btn.dataset.view);
            isl.dataset.state = _playing ? 'playing' : 'idle';
          }
          return;
        }
        // Background click: always toggle expand ↔ playing/idle
        isl.dataset.state = isl.dataset.state === 'expanded'
          ? (_playing ? 'playing' : 'idle')
          : 'expanded';
      });
    }
    // Click on playing face info area → go to now playing
    document.getElementById('iface-playing')?.addEventListener('click', e => {
      if (!e.target.closest('.isl-btn,.isl-play-btn')) {
        App.navigate('nowplaying');
        document.getElementById('island').dataset.state = 'idle';
      }
    });

    // Lyrics FS close
    $('lyrics-fs-close')?.addEventListener('click', closeLyricsFs);

    // Sleep
    $('btn-sleep')?.addEventListener('click', ()=>App.openModal('sleep-modal'));
    document.querySelectorAll('.sleep-opt').forEach(btn => {
      btn.addEventListener('click', ()=>{ setSleep(parseInt(btn.dataset.min)); App.closeModal('sleep-modal'); });
    });
    $('sleep-cancel')?.addEventListener('click', ()=>App.closeModal('sleep-modal'));

    document.addEventListener('keydown', onKey);
  }

  function initSDK(userId) {
    window.onSpotifyWebPlaybackSDKReady = () => {
      _sdk = new Spotify.Player({
        name: 'myspotify musican®',
        getOAuthToken: async cb => {
          const r = await fetch('/api/auth/token');
          if (r.ok) cb((await r.json()).access_token);
        },
        volume: _vol,
      });
      _sdk.addListener('ready', ({device_id}) => {
        _devId = device_id;
        API.transferDevice(device_id, false);
      });
      _sdk.addListener('player_state_changed', onState);
      _sdk.addListener('account_error', ()=>App.toast('Spotify Premium required for playback','err'));
      _sdk.connect();
    };
    if (window.Spotify) window.onSpotifyWebPlaybackSDKReady();
  }

  function onState(state) {
    if (!state) return;
    _state = state;
    _playing = !state.paused;
    _pos0 = state.position;
    _t0 = Date.now();
    const track = state.track_window.current_track;
    if (!track) return;
    const wasPlaying = document.body.classList.contains('playing');
    document.body.classList.toggle('playing', _playing);
    // Show brief notification on play/pause
    if (wasPlaying !== _playing && document.getElementById('island')?.dataset.state !== 'expanded') {
      showIslandNotif(_playing ? 'Playing' : 'Paused', _playing ? '▶' : '⏸');
    }
    // ALWAYS update island state (not just on track change)
    const isl = document.getElementById('island');
    if (isl && isl.dataset.state !== 'expanded') {
      isl.dataset.state = _playing ? 'playing' : 'idle';
    }
    if (track.id !== _lastTrackId) { _lastTrackId = track.id; onTrackChange(track); }
    syncPlayBtns(); syncShuffleRepeat(); startLoop();
    QueueComp?.onState?.(state);
    if (_sleepMode === 'track' && _lastTrackId && track.id !== _lastTrackId) {
      API.pause(); clearSleep(); App.toast('Sleep timer ended','info');
    }
  }

  function onTrackChange(track) {
    updateUI(track);
    notifyBrowser(track);
    if (_lyricsOn && $('view-nowplaying').classList.contains('active')) {
      fetchLyrics(track);
    }
    if (_lyricsFsOpen) { updateLyricsFsMeta(track); fetchLyricsTo($('lyrics-fs-scroll'), track); }
    loadAudioFeatures(track.id);
    AudioEngine?.resume?.();
    Visualizer.updateArt(
      track.album.images[0]?.url || '',
      track.name,
      track.artists.map(a=>a.name).join(', ')
    );
  }

  function updateUI(track) {
    const img    = track.album.images[0]?.url || '';
    const name   = track.name;
    const artist = track.artists.map(a=>a.name).join(', ');
    const dur    = API.ms2t(track.duration_ms);

    $('player-bar').style.display = 'flex';
    document.body.classList.add('playing');

    // Art crossfade
    const pbArt = $('pb-art');
    if (pbArt && pbArt.src !== img) {
      pbArt.style.opacity='0';
      setTimeout(()=>{ pbArt.src=img; pbArt.style.opacity='1'; }, 200);
    }
    $('pb-name').textContent   = name;
    $('pb-artist').textContent = artist;
    $('pb-total').textContent  = dur;

    // Island — all three faces
    const isl = $('island');
    $('isl-art').src  = img;
    $('isl-art-xl').src = img;
    ['isl-name','isl-exp-name'].forEach(id=>{ const el=$(id); if(el) el.textContent=name; });
    ['isl-exp-artist'].forEach(id=>{ const el=$(id); if(el) el.textContent=artist; });
    $('isl-total').textContent = dur;
    if (isl && isl.dataset.state !== 'expanded') isl.dataset.state = 'playing';

    // NP view
    const npArt = $('np-art');
    if (npArt) npArt.src = img;
    $('np-title').textContent      = name;
    $('np-artist-nm').textContent  = artist;
    $('np-total').textContent      = dur;

    // Glow color on NP art
    const glow = $('np-glow');
    if (glow) glow.style.background = `radial-gradient(rgba(var(--ar),var(--ag),var(--ab),.18),transparent 70%)`;

    document.title = `${name} — ${track.artists[0].name} · myspotify musican®`;

    // Like state
    API.checkSaved([track.id]).then(r => {
      const liked = r?.[0] || false;
      $('pb-like')?.classList.toggle('liked', liked);
      $('np-like')?.classList.toggle('liked', liked);
    });

    updateBg(img);
    extractColor(img);
    App.updateNowPlaying(track);
  }

  // Background
  let _bgActive = 'a';
  function updateBg(url) {
    if (!url || document.body.classList.contains('ambient-off')) return;
    const next = _bgActive==='a'?'b':'a', prev=_bgActive;
    const n=$(`bg-${next}`), p=$(`bg-${prev}`);
    if (!n||!p) return;
    n.style.backgroundImage=`url(${url})`;
    n.style.transition='none'; n.style.opacity='0'; n.offsetHeight;
    n.style.transition='opacity 2s ease'; n.style.opacity='1';
    p.style.transition='opacity 2s ease'; p.style.opacity='0';
    _bgActive = next;
  }

  function extractColor(url) {
    if (!url || document.body.classList.contains('ambient-off')) return;
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload = () => {
      const c=document.createElement('canvas'); c.width=c.height=20;
      const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,20,20);
      const d=ctx.getImageData(0,0,20,20).data;
      let r=0,g=0,b=0,n=0;
      for(let i=0;i<d.length;i+=4){
        const l=(d[i]*299+d[i+1]*587+d[i+2]*114)/1000;
        if(l>25&&l<230){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
      }
      if(!n) return;
      r=Math.round(r/n);g=Math.round(g/n);b=Math.round(b/n);
      const max=Math.max(r,g,b);
      if(max>0){const f=Math.min(2.4,170/max);r=Math.min(255,Math.round(r*f));g=Math.min(255,Math.round(g*f));b=Math.min(255,Math.round(b*f));}
      const root=document.documentElement;
      root.style.setProperty('--ar',r);
      root.style.setProperty('--ag',g);
      root.style.setProperty('--ab',b);
    };
    img.onerror=()=>{};
    img.src=url;
  }

  // Audio features
  async function loadAudioFeatures(id) {
    const el=$('np-badges'); if(!el) return;
    const f=await API.audioFeatures(id); if(!f){el.innerHTML='';return;}
    const keys=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const key=f.key>=0?keys[f.key]+(f.mode?'':'m'):'?';
    el.innerHTML=`
      <span class="np-badge np-badge-hi">⚡ ${Math.round(f.energy*100)}%</span>
      <span class="np-badge">♩ ${Math.round(f.tempo)} BPM</span>
      <span class="np-badge">🎵 ${key}</span>
      <span class="np-badge">💃 ${Math.round(f.danceability*100)}%</span>`;
    Visualizer.setTrackInfo(f.tempo, f.energy);
  }

  // Lyrics — strip special chars, multiple fallbacks
  function cleanTitle(s) {
    return s.replace(/[®™©]/g,'').replace(/\s*[\(\[][^\)\]]*[\)\]]/g,' ').replace(/\s+/g,' ').trim();
  }

  async function fetchLyrics(track, container) {
    const el = container || $('np-lyrics');
    const srcEl = container ? null : $('np-lsrc');
    if (!el) return;
    if (!container) { _lyrics=[]; _lastLyricIdx=-1; }
    el.innerHTML=`<div class="ld"><span></span><span></span><span></span></div>`;
    if (srcEl) srcEl.textContent='';

    const name   = track.name;
    const artist = track.artists[0]?.name || '';
    const album  = track.album?.name || '';

    // Multiple search strategies
    const queries = [
      `${name} ${artist}`,
      `${cleanTitle(name)} ${artist}`,
      `${cleanTitle(name)} ${cleanTitle(artist)}`,
      cleanTitle(name),
    ];

    let match = null;
    for (const q of queries) {
      try {
        const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) continue;
        const list = await res.json();
        if (!list?.length) continue;
        // Prefer track with synced lyrics that matches artist
        match = list.find(x => x.syncedLyrics && x.artistName?.toLowerCase().includes(cleanTitle(artist).toLowerCase()))
             || list.find(x => x.syncedLyrics)
             || list.find(x => x.plainLyrics);
        if (match) break;
      } catch {}
    }

    if (!match) {
      el.innerHTML='<div class="ly-empty">No lyrics found</div>';
      return;
    }

    if (match.syncedLyrics) {
      const parsed = match.syncedLyrics.split('\n').map(line => {
        const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
        if (!m) return null;
        return { ms: (parseInt(m[1])*60 + parseFloat(m[2]))*1000, text: m[3].trim() };
      }).filter(Boolean);

      if (!container) _lyrics = parsed;
      el.innerHTML = parsed.map((l,i)=>
        `<div class="ly-line" data-i="${i}">${API.esc(l.text)||'&nbsp;'}</div>`
      ).join('');
      if (srcEl) srcEl.textContent = 'Synced';

      el.querySelectorAll('.ly-line').forEach((line,i) => {
        line.addEventListener('click', ()=>{
          const ms = (container?parsed:_lyrics)[i]?.ms;
          if (ms!==undefined){ API.seek(ms); _pos0=ms; _t0=Date.now(); }
        });
      });
    } else {
      el.innerHTML = match.plainLyrics.split('\n').map((l,i)=>
        `<div class="ly-line" data-i="${i}">${API.esc(l)||'&nbsp;'}</div>`
      ).join('');
      if (srcEl) srcEl.textContent = 'Plain';
    }
  }

  async function fetchLyricsTo(container, track) {
    await fetchLyrics(track, container);
  }

  function syncLyrics(pos) {
    if (!_lyrics.length) return;
    let idx=0;
    for(let i=0;i<_lyrics.length;i++){if(_lyrics[i].ms<=pos)idx=i;else break;}
    if(idx===_lastLyricIdx) return;
    _lastLyricIdx=idx;
    // Sync NP lyrics
    const npEl=$('np-lyrics');
    if(npEl?.querySelector('.ly-line')){
      npEl.querySelectorAll('.ly-line').forEach((l,i)=>l.classList.toggle('active',i===idx));
      const active=npEl.querySelectorAll('.ly-line')[idx];
      if(active) npEl.scrollTo({top:active.offsetTop-npEl.offsetHeight/2+active.offsetHeight/2,behavior:'smooth'});
    }
    // Sync FS lyrics
    if(_lyricsFsOpen){
      const fsEl=$('lyrics-fs-scroll');
      if(fsEl?.querySelector('.ly-line')){
        fsEl.querySelectorAll('.ly-line').forEach((l,i)=>l.classList.toggle('active',i===idx));
        const active=fsEl.querySelectorAll('.ly-line')[idx];
        if(active) fsEl.scrollTo({top:active.offsetTop-fsEl.offsetHeight/2+active.offsetHeight/2,behavior:'smooth'});
      }
    }
    // Sync musican lyrics mode
    Visualizer.syncMusicanLyrics?.(pos);
  }

  function toggleLyricsPanel() {
    _lyricsOn=!_lyricsOn;
    $('np-lyrics-toggle')?.classList.toggle('on',_lyricsOn);
    const right=$('np-right'), layout=$('np-layout');
    if(right) right.style.display=_lyricsOn?'':'none';
    if(layout) layout.classList.toggle('lyrics-off',!_lyricsOn);
    if(_lyricsOn&&_state?.track_window?.current_track) fetchLyrics(_state.track_window.current_track);
  }

  // Lyrics fullscreen
  function openLyricsFs() {
    const fs=$('lyrics-fs'); if(!fs) return;
    _lyricsFsOpen=true;
    const track=_state?.track_window?.current_track;
    if(track){ updateLyricsFsMeta(track); fetchLyricsTo($('lyrics-fs-scroll'),track); }
    fs.classList.remove('closing'); fs.style.display='flex';
    document.body.classList.add('lfs-open');
    $('pb-lyrics-btn')?.classList.add('on');
    $('np-lyrics-fs')?.classList.add('on');
  }

  function closeLyricsFs() {
    const fs=$('lyrics-fs'); if(!fs) return;
    _lyricsFsOpen=false;
    fs.classList.add('closing');
    fs.addEventListener('animationend',()=>{ fs.style.display='none'; fs.classList.remove('closing'); },{once:true});
    document.body.classList.remove('lfs-open');
    $('pb-lyrics-btn')?.classList.remove('on');
    $('np-lyrics-fs')?.classList.remove('on');
  }

  function updateLyricsFsMeta(track) {
    const img=track.album.images[0]?.url||'';
    const el=(id,val)=>{ const e=$(id); if(e) e[typeof val==='string'&&id.endsWith('src')?'src':'textContent']=val; };
    const setStyle=(id,prop,val)=>{ const e=$(id); if(e) e.style[prop]=val; };
    const fsArt=$('lyrics-fs-art'); if(fsArt) fsArt.src=img;
    setStyle('lyrics-fs-bg','backgroundImage',`url(${img})`);
    $('lyrics-fs-title').textContent=track.name;
    $('lyrics-fs-artist').textContent=track.artists.map(a=>a.name).join(', ');
  }

  // Radio
  async function startRadio() {
    const track=_state?.track_window?.current_track; if(!track) return;
    App.toast('Starting track radio…','info');
    const data=await API.recommendations({seed_tracks:track.id,limit:25});
    if(!data?.tracks?.length){ App.toast('No radio available','err'); return; }
    await API.play(_devId,{uris:data.tracks.map(t=>t.uri)});
    App.toast(`Radio: ${track.name}`,'ok');
  }

  // Progress loop
  function startLoop() {
    if(_raf) cancelAnimationFrame(_raf);
    if(!_playing){ updateBars(getPos()); return; }
    const tick=()=>{
      const pos=getPos(); updateBars(pos); syncLyrics(pos); checkNextUp(pos);
      if(_playing) _raf=requestAnimationFrame(tick);
    };
    _raf=requestAnimationFrame(tick);
  }
  function getPos(){ return _playing?_pos0+(Date.now()-_t0):_pos0; }

  let _nextUpShown = false;
  function checkNextUp(pos) {
    const dur = _state?.track_window?.current_track?.duration_ms || 0;
    const remaining = dur - pos;
    // Show "next up" when 15 seconds remain
    if (remaining < 15000 && remaining > 12000 && !_nextUpShown && _playing) {
      _nextUpShown = true;
      const next = _state?.track_window?.next_tracks?.[0];
      if (next) {
        showIslandNotif(`Next: ${next.name}`, '⏭');
        // Also show mini toast
        App.toast(`Up next: ${next.name} — ${next.artists?.[0]?.name||''}`, 'info');
      }
    }
    if (remaining > 20000) _nextUpShown = false;
  }

  function updateBars(pos) {
    if(_barDrag) return;
    const dur=_state?.track_window?.current_track?.duration_ms||1;
    const pct=Math.min(pos/dur,1)*100, ts=API.ms2t(pos);
    setFill('pb-fill','pb-bar',pct); setFill('np-fill','np-bar',pct);
    [$('isl-prog'),$('isl-prog2')].forEach(el=>{ if(el) el.style.width=`${pct}%`; });
    $('pb-elapsed').textContent=ts;
    $('np-elapsed').textContent=ts;
    $('isl-elapsed').textContent=ts;
  }
  function setFill(fId,bId,pct){
    const f=$(fId),b=$(bId);
    if(f) f.style.width=`${pct}%`;
    if(b){ const t=b.querySelector('.pb-thumb,.np-thumb'); if(t) t.style.left=`${pct}%`; }
  }

  function initBar(bId,fId){
    const bar=$(bId); if(!bar) return;
    const getP=e=>{ const r=bar.getBoundingClientRect(); return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); };
    bar.addEventListener('mousedown',e=>{
      _barDrag=true;
      const upd=e=>{ $(fId).style.width=`${getP(e)*100}%`; };
      const up=e=>{ _barDrag=false; const ms=Math.floor(getP(e)*(_state?.track_window?.current_track?.duration_ms||0)); API.seek(ms); _pos0=ms; _t0=Date.now(); startLoop(); document.removeEventListener('mousemove',upd); document.removeEventListener('mouseup',up); };
      upd(e); document.addEventListener('mousemove',upd); document.addEventListener('mouseup',up);
    });
  }

  function initVolSlider(tId,fId,onChange){
    const t=$(tId); if(!t) return; const f=$(fId);
    const getV=e=>{ const r=t.getBoundingClientRect(); return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); };
    t.addEventListener('mousedown',e=>{
      const move=e=>{ f.style.width=`${getV(e)*100}%`; };
      const up=e=>{ onChange(getV(e)); document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); };
      move(e); document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
    });
  }

  function setVol(v,osd){
    v=Math.max(0,Math.min(1,v)); _vol=v;
    $('pb-vol-f').style.width=`${v*100}%`;
    $('np-vol-fill').style.width=`${v*100}%`;
    if(_sdk)_sdk.setVolume(v);
    API.setVolume(Math.round(v*100));
    if(osd) showVolOSD(v);
  }

  function toggleMute(){
    if(_muted){setVol(_volBak,true);_muted=false;}
    else{_volBak=_vol;setVol(0,true);_muted=true;}
  }

  function showVolOSD(v){
    const osd=$('vol-osd');
    $('osd-fill').style.width=`${v*100}%`;
    $('osd-pct').textContent=`${Math.round(v*100)}%`;
    osd.classList.remove('closing'); osd.style.display='flex';
    clearTimeout(_osdTimer);
    _osdTimer=setTimeout(()=>{
      osd.classList.add('closing');
      osd.addEventListener('animationend',()=>{ osd.style.display='none'; osd.classList.remove('closing'); },{once:true});
    }, 1800);
  }

  async function togglePlay(){ if(_sdk) await _sdk.togglePlay(); }

  async function sdkNext(){
    try { if(_sdk){ await _sdk.nextTrack(); return; } } catch{}
    await API.nextTrack();
  }
  async function sdkPrev(){
    try { if(_sdk){ await _sdk.previousTrack(); return; } } catch{}
    await API.prevTrack();
  }

  async function toggleShuffle(){
    if(!_state) return;
    // Cycle: off → shuffle → smart shuffle (repeat context)
    const s=!_state.shuffle; await API.setShuffle(s); _state.shuffle=s;
    [$('pb-shuffle'),$('np-shuffle'),$('isl-shuffle')].forEach(b=>{
      if(!b) return;
      b.classList.toggle('on',s);
      b.title = s ? 'Shuffle on' : 'Shuffle off';
    });
    App.toast(s ? 'Shuffle on' : 'Shuffle off','info');
  }

  async function toggleRepeat(){
    if(!_state) return;
    const modes=['off','context','track'], next=modes[((_state.repeat_mode||0)+1)%3];
    await API.setRepeat(next); _state.repeat_mode=modes.indexOf(next);
    const on=_state.repeat_mode>0;
    [$('pb-repeat'),$('np-repeat'),$('isl-repeat')].forEach(b=>b?.classList.toggle('on',on));
  }

  async function toggleLike(){
    const track=_state?.track_window?.current_track; if(!track) return;
    const liked=$('pb-like').classList.contains('liked');
    $('pb-like').classList.add('pop'); setTimeout(()=>$('pb-like').classList.remove('pop'),400);
    if(liked){
      await API.unsaveTracks([track.id]);
      [$('pb-like'),$('np-like')].forEach(b=>b?.classList.remove('liked'));
      App.toast('Removed from Liked Songs','info');
    } else {
      await API.saveTracks([track.id]);
      [$('pb-like'),$('np-like')].forEach(b=>b?.classList.add('liked'));
      App.toast('Saved to Liked Songs ♥','ok');
    }
  }

  function syncPlayBtns(){
    [$('pb-play'),$('np-play'),$('isl-play')].forEach(btn=>{
      if(!btn) return;
      btn.querySelector('.ico-play').style.display  = _playing?'none':'block';
      btn.querySelector('.ico-pause').style.display = _playing?'block':'none';
    });
  }

  function syncShuffleRepeat(){
    if(!_state) return;
    [$('pb-shuffle'),$('np-shuffle'),$('isl-shuffle')].forEach(b=>b?.classList.toggle('on',_state.shuffle));
    const on=_state.repeat_mode>0;
    [$('pb-repeat'),$('np-repeat'),$('isl-repeat')].forEach(b=>b?.classList.toggle('on',on));
  }

  // Sleep timer
  function setSleep(min){
    clearSleep();
    if(min===0){ _sleepMode='track'; $('sleep-pill').style.display='flex'; $('sleep-txt').textContent='track end'; App.toast('Sleep: after this track','info'); return; }
    _sleepMode='time'; _sleepEnd=Date.now()+min*60000;
    $('sleep-pill').style.display='flex'; App.toast(`Sleep: ${min} min`,'info');
    _sleepTick=setInterval(()=>{
      const l=_sleepEnd-Date.now();
      if(l<=0){ API.pause(); clearSleep(); App.toast('Sleep timer ended','info'); return; }
      const m=Math.floor(l/60000), s=Math.floor((l%60000)/1000);
      $('sleep-txt').textContent=`${m}:${s.toString().padStart(2,'0')}`;
    },1000);
  }
  function clearSleep(){ clearInterval(_sleepTick); _sleepMode=null; $('sleep-pill').style.display='none'; }

  function notifyBrowser(track){
    if(!document.hidden||Notification.permission!=='granted') return;
    try{ new Notification(track.name,{body:track.artists.map(a=>a.name).join(', '),icon:track.album.images[0]?.url,silent:true}); }catch{}
  }

  function onKey(e){
    const tag=e.target.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
    const{key,metaKey:m,ctrlKey:c}=e; const mod=m||c;
    if(key===' '&&!mod){ e.preventDefault(); togglePlay(); return; }
    if(mod&&key==='ArrowRight'){ e.preventDefault(); sdkNext(); return; }
    if(mod&&key==='ArrowLeft'){  e.preventDefault(); sdkPrev(); return; }
    if(mod&&key==='ArrowUp'){    e.preventDefault(); setVol(Math.min(1,_vol+.05),true); return; }
    if(mod&&key==='ArrowDown'){  e.preventDefault(); setVol(Math.max(0,_vol-.05),true); return; }
    if(mod&&key==='f'){  e.preventDefault(); App.navigate('search'); return; }
    if(mod&&key==='q'){  e.preventDefault(); QueueComp?.toggle(); return; }
    if(mod&&key==='t'){  e.preventDefault(); App.openModal('sleep-modal'); return; }
    if(mod&&key==='h'){  e.preventDefault(); App.navigate('home'); return; }
    if(mod&&key===','){  e.preventDefault(); App.navigate('settings'); return; }
    if(mod&&key==='l'){  e.preventDefault(); openLyricsFs(); return; }
    if(key==='s'&&!mod) toggleShuffle();
    if(key==='r'&&!mod) toggleRepeat();
    if(key==='l'&&!mod) toggleLike();
    if(key==='v'&&!mod) Visualizer.toggle();
    if(key==='n'&&!mod) App.navigate('nowplaying');
    if(key==='c'&&!mod) document.getElementById('customize-panel').classList.toggle('open');
    if(key==='?')        App.openModal('keys-modal');
    if(key==='Escape')   App.closeAll();
  }

  async function playContext(uri,offset){ const body={context_uri:uri}; if(offset!==undefined) body.offset={position:offset}; await API.play(_devId,body); }
  async function playTrack(uri,ctx,offset){
    if(ctx) { await playContext(ctx,offset); return; }
    // Single track — add radio queue so music doesn't stop
    await API.play(_devId,{uris:[uri]});
    // Queue up recommendations in background
    const trackId = uri.split(':').pop();
    API.recommendations({seed_tracks:trackId,limit:10}).then(recs=>{
      if(recs?.tracks?.length) {
        recs.tracks.slice(0,5).forEach(t => API.addToQueue(t.uri).catch(()=>{}));
      }
    }).catch(()=>{});
  }
  function onNPOpen(){ const track=_state?.track_window?.current_track; if(track&&_lyricsOn) fetchLyrics(track); if(Notification.permission==='default') Notification.requestPermission(); }
  function getDeviceId(){ return _devId; }
  function getState(){ return _state; }
  function isPlaying(){ return _playing; }

  // ── Island mini-notifications ─────────────────
  let _notifTimer = null;
  function showIslandNotif(text, icon='') {
    const isl = document.getElementById('island');
    if (!isl || isl.dataset.state === 'expanded') return;
    // Create or reuse notif pill
    let notif = document.getElementById('isl-notif');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'isl-notif';
      notif.style.cssText = [
        'position:fixed;top:8px;left:50%;transform:translateX(-50%)',
        'background:rgba(8,8,14,.97)',
        'border:1px solid rgba(255,255,255,.15)',
        'border-radius:100px',
        'padding:6px 18px',
        'font-size:12px;font-weight:600;color:#fff',
        'z-index:9998',
        'pointer-events:none',
        'white-space:nowrap',
        'display:flex;align-items:center;gap:8px',
        'animation:notif-in .25s cubic-bezier(.34,1.56,.64,1)',
        'box-shadow:0 4px 20px rgba(0,0,0,.6)',
      ].join(';');
      document.body.appendChild(notif);
    }
    notif.innerHTML = `${icon ? `<span>${icon}</span>` : ''}<span>${text}</span>`;
    notif.style.display = 'flex';
    notif.style.animation = 'none'; notif.offsetHeight;
    notif.style.animation = 'notif-in .25s cubic-bezier(.34,1.56,.64,1)';
    clearTimeout(_notifTimer);
    _notifTimer = setTimeout(() => {
      notif.style.animation = 'notif-out .25s ease forwards';
      notif.addEventListener('animationend', () => { notif.style.display='none'; }, {once:true});
    }, 1800);
  }

  return { init,initSDK,playContext,playTrack,getDeviceId,getState,isPlaying,onNPOpen,startRadio,openLyricsFs,closeLyricsFs };
})();
