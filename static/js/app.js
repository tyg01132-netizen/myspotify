/* app.js — myspotify musican® v2.5.2 */
const App = (() => {
  let _userId = null;

  /* ── Welcome ──────────────────────────────────── */
  function initWelcome() {
    const canvas = document.getElementById('wc-canvas');
    const welcome= document.getElementById('welcome');
    if (!canvas||!welcome) return;
    const ctx = canvas.getContext('2d');
    let W,H,pts=[],animId;
    function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
    resize(); window.addEventListener('resize',resize);
    for(let i=0;i<85;i++) pts.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2+0.4,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,a:Math.random()*.4+.08,hue:130+Math.random()*50});
    function draw(){
      animId=requestAnimationFrame(draw);
      ctx.clearRect(0,0,W,H);
      for(let i=0;i<pts.length;i++){
        for(let j=i+1;j<pts.length;j++){
          const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
          if(d<140){ctx.beginPath();ctx.strokeStyle=`rgba(29,185,84,${.055*(1-d/140)})`;ctx.lineWidth=.5;ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.stroke();}
        }
        const p=pts[i];
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`hsla(${p.hue},60%,60%,${p.a})`;ctx.fill();
        p.x+=p.vx;p.y+=p.vy;
        if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      }
    }
    draw();
    let done=false;
    function dismiss(){
      if(done)return;done=true;
      cancelAnimationFrame(animId);
      welcome.classList.add('out');
      welcome.addEventListener('animationend',()=>welcome.style.display='none',{once:true});
    }
    const t=setTimeout(dismiss,4500);
    welcome.addEventListener('click',()=>{clearTimeout(t);dismiss();});
  }

  /* ── Init ─────────────────────────────────────── */
  async function init() {
    initWelcome();
    Customize.init();
    Visualizer.init();
    Player.init();
    SearchView.init();
    LibraryView.init();
    QueueComp.init();
    DevicesComp.init();

    // Titlebar buttons
    document.getElementById('btn-musican')?.addEventListener('click', ()=>Visualizer.toggle());
    document.getElementById('btn-customize')?.addEventListener('click', ()=>document.getElementById('customize-panel').classList.toggle('open'));
    document.getElementById('btn-help')?.addEventListener('click', ()=>Tour.show());
    document.getElementById('btn-keys')?.addEventListener('click', ()=>openModal('keys-modal'));
    document.getElementById('tb-avatar')?.addEventListener('click', ()=>navigate('settings'));

    // Fallback nav
    document.querySelectorAll('.fn-btn[data-view]').forEach(el=>{
      el.addEventListener('click', e=>{ e.preventDefault(); navigate(el.dataset.view); });
    });

    // Modal closes
    ['keys-close','sleep-cancel','new-pl-cancel'].forEach(id=>{
      document.getElementById(id)?.addEventListener('click', ()=>closeModal(id.replace(/-\w+$/,'').replace('keys','keys') + '-modal' || 'keys-modal'));
    });
    document.getElementById('keys-close')?.addEventListener('click',   ()=>closeModal('keys-modal'));
    document.getElementById('sleep-cancel')?.addEventListener('click', ()=>closeModal('sleep-modal'));
    document.getElementById('new-pl-cancel')?.addEventListener('click',()=>closeModal('new-pl-modal'));
    document.getElementById('new-pl-create')?.addEventListener('click',createNewPlaylist);
    document.querySelectorAll('.modal-bg').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeModal(el.id);}));

    // Panels
    document.getElementById('customize-close')?.addEventListener('click',()=>document.getElementById('customize-panel').classList.remove('open'));
    document.getElementById('home-customize-btn')?.addEventListener('click',()=>document.getElementById('customize-panel').classList.add('open'));

    // Queue/devices panels
    document.getElementById('nav-queue')?.addEventListener('click', e=>{e.preventDefault();e.stopPropagation();QueueComp.toggle();});

    // AI DJ
    document.getElementById('aidj-play-btn')?.addEventListener('click', loadAiDj);

    // Settings tour btn
    document.getElementById('s-tour-btn')?.addEventListener('click',()=>{ navigate('home'); setTimeout(()=>Tour.show(),100); });

    // Click outside island = close
    document.addEventListener('click', e=>{
      document.getElementById('ctx-menu').style.display='none';
      const isl=document.getElementById('island');
      if(isl?.dataset.state==='expanded' && !isl.contains(e.target)){
        isl.dataset.state = Player.isPlaying() ? 'playing' : 'idle';
      }
    });
    document.addEventListener('contextmenu',e=>e.preventDefault());

    // Auth
    const params=new URLSearchParams(window.location.search);
    if(params.get('auth_error')){ toast('Login failed: '+params.get('auth_error'),'err'); history.replaceState({},'','/'); }
    const status=await fetch('/api/auth/status').then(r=>r.json()).catch(()=>({logged_in:false}));
    if(params.get('logged_in')==='1'||status.logged_in){
      history.replaceState({},'','/');
      await onLoggedIn();
    } else {
      await checkCreds();
    }
  }

  /* ── Auth ─────────────────────────────────────── */
  async function checkCreds() {
    const s=await fetch('/api/settings').then(r=>r.json()).catch(()=>({}));
    const setup=document.getElementById('setup-card');
    const action=document.getElementById('login-action');
    if(s.configured){ setup.style.display='none'; action.style.display='flex'; }
    else{ setup.style.display='flex'; action.style.display='none'; if(s.client_id) document.getElementById('in-cid').value=s.client_id; }
    setView('login');

    const saveBtn=document.getElementById('btn-save-creds');
    const newSave=saveBtn.cloneNode(true); saveBtn.parentNode.replaceChild(newSave,saveBtn);
    newSave.addEventListener('click',saveCreds);
    document.getElementById('in-cs')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveCreds();});

    const loginBtn=document.getElementById('btn-login');
    if(loginBtn){ const nl=loginBtn.cloneNode(true); loginBtn.parentNode.replaceChild(nl,loginBtn); nl.addEventListener('click',doLogin); }
    document.getElementById('btn-change-creds')?.addEventListener('click',()=>{ setup.style.display='flex'; action.style.display='none'; });
  }

  async function saveCreds() {
    const id=document.getElementById('in-cid').value.trim();
    const sec=document.getElementById('in-cs').value.trim();
    if(!id||!sec){ toast('Fill in both Client ID and Secret','err'); return; }
    const btn=document.getElementById('btn-save-creds');
    btn.textContent='Saving…'; btn.disabled=true;
    const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:id,client_secret:sec})}).catch(()=>null);
    btn.textContent='Save & Continue →'; btn.disabled=false;
    if(!r?.ok){ toast('Failed to save credentials','err'); return; }
    document.getElementById('setup-card').style.display='none';
    document.getElementById('login-action').style.display='flex';
    toast('Credentials saved ✓','ok');
  }

  async function doLogin() {
    const btn=document.getElementById('btn-login');
    if(btn){btn.style.opacity='0.6';btn.style.pointerEvents='none';}
    try{
      const r=await fetch('/api/auth/login');
      if(!r.ok){ toast('Server error – is start.bat running?','err'); return; }
      const d=await r.json();
      if(d.url) window.location.href=d.url;
      else toast('Could not start login – check credentials','err');
    }catch{ toast('Cannot connect – run start.bat first','err'); }
    finally{ if(btn){btn.style.opacity='';btn.style.pointerEvents='';} }
  }

  async function onLoggedIn() {
    const user=await API.me();
    if(user){
      _userId=user.id;
      const img=document.getElementById('avatar-img');
      if(user.images?.[0]?.url&&img) img.src=user.images[0].url;
      // Store name in title for greeting
      document.getElementById('tb-avatar').title=user.display_name||user.id;
      const si=document.getElementById('s-user-info');
      if(si) si.textContent=`${user.display_name||user.id} · ${user.product==='premium'?'Premium ✓':'Free'}`;
    }

    document.getElementById('player-bar').style.display='flex';
    Player.initSDK(_userId);
    navigate('home');
    Tour.init();

    if('Notification'in window&&Notification.permission==='default') Notification.requestPermission();

    // Settings wiring
    const s=await fetch('/api/settings').then(r=>r.json()).catch(()=>({}));
    if(s.client_id){ const el=document.getElementById('s-cid'); if(el) el.value=s.client_id; }
    document.getElementById('s-save')?.addEventListener('click',async()=>{
      const id=document.getElementById('s-cid')?.value.trim();
      const sec=document.getElementById('s-cs')?.value.trim();
      if(!id){ toast('Client ID required','err'); return; }
      const body={client_id:id}; if(sec) body.client_secret=sec;
      await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      toast('Settings saved ✓','ok');
    });
    document.getElementById('s-logout')?.addEventListener('click',async()=>{
      if(!confirm('Log out? Credentials will be kept, only the login session is cleared.')) return;
      await fetch('/api/auth/logout',{method:'POST'});
      logout();
    });
  }

  /* ── AI DJ ────────────────────────────────────── */
  async function loadAiDj() {
    const btn=document.getElementById('aidj-play-btn');
    const list=document.getElementById('aidj-list');
    if(btn){btn.style.opacity='0.6';btn.style.pointerEvents='none';btn.textContent='Building your mix…';}

    // Try multiple time ranges for seeds
    let seedTracks='', seedArtists='';
    for (const range of ['short_term','medium_term','long_term']) {
      if (!seedTracks) { const t=await API.topTracks(5,range); seedTracks=(t?.items||[]).slice(0,3).map(x=>x.id).filter(Boolean).join(','); }
      if (!seedArtists){ const a=await API.topArtists(3,range); seedArtists=(a?.items||[]).slice(0,2).map(x=>x.id).filter(Boolean).join(','); }
      if (seedTracks&&seedArtists) break;
    }
    if (!seedTracks) { const rp=await API.recentlyPlayed(5); seedTracks=(rp?.items||[]).slice(0,3).map(i=>i.track?.id).filter(Boolean).join(','); }

    const params={limit:30,target_energy:0.7,target_danceability:0.6};
    if (seedTracks)  params.seed_tracks=seedTracks;
    if (seedArtists) params.seed_artists=seedArtists;
    if (!seedTracks&&!seedArtists) params.seed_genres='pop,rock,hip-hop';

    const recs=await API.recommendations(params);
    if(btn){btn.style.opacity='';btn.style.pointerEvents='';btn.textContent='▶ Play DJ Mix';}

    if(!recs?.tracks?.length){
      if(list) list.innerHTML='<div class="empty-msg" style="padding:24px 36px">Could not generate a mix. Try playing a few songs in Spotify first, then come back.</div>';
      return;
    }

    // Wire play button to play the mix
    const newBtn=btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn,btn);
    newBtn.style.opacity=''; newBtn.style.pointerEvents=''; newBtn.textContent='▶ Play DJ Mix';
    newBtn.addEventListener('click',()=>API.play(Player.getDeviceId(),{uris:recs.tracks.map(t=>t.uri)}));

    if(list){
      list.innerHTML=`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding:0 36px">
          <h2 class="sec-title">Your AI DJ Mix</h2>
          <span style="font-size:12px;color:var(--i3)">${recs.tracks.length} tracks · Personalized for you</span>
        </div>
        <div class="tlist stagger" style="padding:0 36px">${recs.tracks.map((t,i)=>HomeView.trackRow(t,i,null,true)).join('')}</div>`;
      HomeView.attachTrackEvents(list.querySelector('.tlist'), recs.tracks, null);
    }
    toast('AI DJ mix ready!','ok');
  }

  /* ── Router ───────────────────────────────────── */
  function navigate(view, id) {
    document.querySelectorAll('.isl-nav-btn[data-view], .fn-btn[data-view]').forEach(el=>{
      el.classList.toggle('active', el.dataset.view===view);
    });
    switch(view){
      case 'home':       setView('home');       HomeView.render();                   break;
      case 'search':     setView('search');     SearchView.onShow?.();               break;
      case 'library':    setView('library');    LibraryView.render();                break;
      case 'playlist':   setView('playlist');   PlaylistView.render('playlist',id);  break;
      case 'liked':      setView('playlist');   PlaylistView.render('liked',null);   break;
      case 'album':      setView('playlist');   PlaylistView.render('album',id);     break;
      case 'artist':     setView('artist');     ArtistView.render(id);              break;
      case 'nowplaying': setView('nowplaying'); Player.onNPOpen();                  break;
      case 'aidj':       setView('aidj');                                            break;
      case 'settings':   setView('settings');                                        break;
    }
  }

  function setView(name) {
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(`view-${name}`)?.classList.add('active');
  }

  /* ── Context menu ─────────────────────────────── */
  function showCtxMenu(e, trackId, trackUri, trackName) {
    const plCtx    = typeof PlaylistView!=='undefined' ? PlaylistView.getCurrentContext?.() : null;
    const canRemove= plCtx?.type==='playlist' && plCtx?.id && trackUri;
    const menu=document.getElementById('ctx-menu');
    menu.innerHTML=`
      <button class="ctx-item" id="ctx-q"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>Add to queue</button>
      <button class="ctx-item" id="ctx-like"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Save to Liked Songs</button>
      <button class="ctx-item" id="ctx-addpl"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add to playlist</button>
      <button class="ctx-item" id="ctx-radio"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6s4-4 11-4 11 4 11 4"/><path d="M5 10s2-3 7-3 7 3 7 3"/><path d="M9 14s1-1 3-1 3 1 3 1"/></svg>Track radio</button>
      ${canRemove?`<div class="ctx-div"></div><button class="ctx-item red" id="ctx-remove"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Remove from playlist</button>`:''}
      <div class="ctx-div"></div>
      <button class="ctx-item" id="ctx-copy"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Spotify link</button>`;

    menu.style.display='block';
    const mw=menu.offsetWidth, mh=menu.offsetHeight;
    menu.style.left=`${Math.min(e.clientX,window.innerWidth-mw-8)}px`;
    menu.style.top =`${Math.min(e.clientY,window.innerHeight-mh-8)}px`;

    document.getElementById('ctx-q').onclick    = async()=>{ await API.addToQueue(trackUri); toast('Added to queue','ok'); QueueComp?.load(); };
    document.getElementById('ctx-like').onclick  = async()=>{ await API.saveTracks([trackId]); toast('Saved to Liked Songs ♥','ok'); };
    document.getElementById('ctx-addpl').onclick = ()=>openAddToPlaylist(trackUri);
    document.getElementById('ctx-radio').onclick = async()=>{
      toast('Starting track radio…','info');
      const d=await API.recommendations({seed_tracks:trackId,limit:25});
      if(!d?.tracks?.length){ toast('No radio available','err'); return; }
      await API.play(Player.getDeviceId(),{uris:d.tracks.map(t=>t.uri)});
      toast('Track radio started','ok');
    };
    if(canRemove){
      document.getElementById('ctx-remove').onclick=async()=>{
        await API.removeFromPlaylist(plCtx.id,[trackUri]);
        toast('Removed','info');
        PlaylistView.render('playlist',plCtx.id);
      };
    }
    document.getElementById('ctx-copy').onclick=()=>{ navigator.clipboard.writeText(`https://open.spotify.com/track/${trackId}`); toast('Link copied','info'); };
  }

  /* ── Add to playlist ──────────────────────────── */
  let _pendingUri=null;
  async function openAddToPlaylist(trackUri) {
    _pendingUri=trackUri; openModal('add-pl-modal');
    const list=document.getElementById('add-pl-list');
    const search=document.getElementById('add-pl-search');
    list.innerHTML=`<div style="padding:8px 0;color:var(--i3)"><div class="ld"><span></span><span></span><span></span></div></div>`;
    search.value='';
    const d=await API.myPlaylists(50);
    const pls=(d?.items||[]).filter(p=>p.owner?.id===_userId);
    function rl(f){
      const filtered=f?pls.filter(p=>p.name.toLowerCase().includes(f)):pls;
      list.innerHTML=filtered.map(p=>{const img=API.imgUrl(p.images,40);return`<div class="modal-pl-item" data-id="${p.id}">${img?`<img class="modal-pl-art" src="${img}" alt=""/>` :'<div class="modal-pl-art"></div>'}<div class="modal-pl-name">${API.esc(p.name)}</div></div>`;}).join('')||'<div class="empty-msg" style="padding:8px 0">No playlists</div>';
      list.querySelectorAll('.modal-pl-item').forEach(item=>item.addEventListener('click',async()=>{ await API.addToPlaylist(item.dataset.id,[_pendingUri]); toast('Added ✓','ok'); closeModal('add-pl-modal'); }));
    }
    rl('');
    search.addEventListener('input',()=>rl(search.value.toLowerCase()));
    document.getElementById('add-pl-new').onclick=()=>{ closeModal('add-pl-modal'); openNewPlaylist(_pendingUri); };
  }

  let _newPlUri=null;
  function openNewPlaylist(trackUri){ _newPlUri=trackUri||null; openModal('new-pl-modal'); document.getElementById('new-pl-name').value=''; document.getElementById('new-pl-desc').value=''; setTimeout(()=>document.getElementById('new-pl-name').focus(),80); }
  async function createNewPlaylist(){
    const name=document.getElementById('new-pl-name').value.trim();
    const desc=document.getElementById('new-pl-desc').value.trim();
    if(!name){ toast('Enter a name','err'); return; }
    if(!_userId){ toast('Not logged in','err'); return; }
    const pl=await API.createPlaylist(_userId,name,desc);
    if(!pl?.id){ toast('Failed to create','err'); return; }
    if(_newPlUri) await API.addToPlaylist(pl.id,[_newPlUri]);
    toast(`"${name}" created ✓`,'ok'); closeModal('new-pl-modal'); navigate('playlist',pl.id);
  }

  /* ── Modals ───────────────────────────────────── */
  function openModal(id){ const el=document.getElementById(id); if(!el) return; el.classList.remove('closing'); el.style.display='flex'; }
  function closeModal(id){ const el=document.getElementById(id); if(!el||el.style.display==='none') return; el.classList.add('closing'); el.addEventListener('animationend',()=>{ el.style.display='none'; el.classList.remove('closing'); },{once:true}); }
  function closeAll(){
    ['sleep-modal','keys-modal','add-pl-modal','new-pl-modal'].forEach(closeModal);
    document.getElementById('ctx-menu').style.display='none';
    document.getElementById('customize-panel').classList.remove('open');
    Visualizer.hide();
    Player.closeLyricsFs?.();
  }

  /* ── Toast ────────────────────────────────────── */
  function toast(msg,type='info'){
    const rack=document.getElementById('toast-rack'); if(!rack) return;
    const el=document.createElement('div');
    el.className=`toast t-${type==='ok'?'ok':type==='err'?'err':'info'}`;
    el.textContent=msg; rack.appendChild(el);
    setTimeout(()=>{ el.classList.add('out'); el.addEventListener('animationend',()=>el.remove()); },3200);
  }

  function updateNowPlaying(track){
    document.querySelectorAll('.tr').forEach(row=>row.classList.toggle('playing',row.dataset.uri===track.uri));
  }

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});
    API.clearToken();
    document.getElementById('player-bar').style.display='none';
    document.getElementById('avatar-img').src='';
    document.body.classList.remove('playing');
    _userId=null;
    const isl=document.getElementById('island');
    if(isl) isl.dataset.state='idle';
    await checkCreds();
    toast('Logged out','info');
  }

  function getUserId(){ return _userId; }
  function openSpotlight(){ navigate('search'); }

  return {
    init,navigate,setView,
    toast,showCtxMenu,
    openModal,closeModal,closeAll,
    openSpotlight,openAddToPlaylist,openNewPlaylist,
    updateNowPlaying,logout,getUserId,
  };
})();

document.addEventListener('DOMContentLoaded', ()=>App.init());
