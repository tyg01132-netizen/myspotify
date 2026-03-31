/* views/home.js */
const HomeView = (() => {

  async function render() {
    // Greeting with first name
    const h = new Date().getHours();
    const timeGreet = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    const avatarTitle = document.getElementById('tb-avatar')?.title || '';
    const firstName = avatarTitle.split('·')[0].split(' ')[0].trim();
    const greetEl = document.getElementById('home-greeting');
    if (greetEl) greetEl.textContent = firstName ? `${timeGreet}, ${firstName}` : timeGreet;

    const show = k => Customize.getPref(`hw_${k}`, true);

    const quickEl = document.getElementById('quick-grid');
    const bentoEl = document.getElementById('bento');
    const secEl   = document.getElementById('home-sections');

    quickEl.style.display = show('quick') ? '' : 'none';
    bentoEl.style.display = show('bento') ? '' : 'none';

    // Skeletons
    if (show('quick')) quickEl.innerHTML = Array(6).fill(`<div class="skel" style="height:52px;border-radius:10px"></div>`).join('');
    if (show('bento')) bentoEl.innerHTML = `
      <div class="skel" style="grid-column:1;grid-row:1/3;border-radius:16px"></div>
      <div class="skel" style="grid-column:2;grid-row:1;border-radius:16px"></div>
      <div class="skel" style="grid-column:3;grid-row:1;border-radius:16px"></div>
      <div class="skel" style="grid-column:2;grid-row:2;border-radius:16px"></div>
      <div class="skel" style="grid-column:3;grid-row:2;border-radius:16px"></div>`;
    secEl.innerHTML = '';

    const [recent, featured, topArtists, topTracks, newRel] = await Promise.all([
      API.recentlyPlayed(12),
      API.featuredPlaylists(),
      API.topArtists(10),
      API.topTracks(10),
      API.newReleases(),
    ]);

    const recentTracks = recent?.items?.map(i=>i.track).filter(Boolean) || [];
    const featuredPls  = featured?.playlists?.items?.filter(Boolean) || [];

    // Quick grid
    if (show('quick')) {
      const items = [
        { name:'Liked Songs', img:'', gradient:'linear-gradient(135deg,#450af5,#c4efd9)', action:()=>App.navigate('liked') },
        { name:'AI DJ',       img:'', gradient:`linear-gradient(135deg,var(--acc),rgba(var(--ar),var(--ag),var(--ab),.3))`, action:()=>App.navigate('aidj') },
        ...recentTracks.slice(0,4).map(t=>({ name:t.name, img:API.imgUrl(t.album?.images,60), action:()=>Player.playTrack(t.uri) }))
      ].slice(0,6);
      quickEl.innerHTML = items.map(item=>`
        <div class="quick-item">
          ${item.img
            ? `<img class="quick-art" src="${API.esc(item.img)}" alt="" loading="lazy"/>`
            : `<div class="quick-art" style="background:${item.gradient||'var(--b3)'}"></div>`}
          <span class="quick-name">${API.esc(item.name)}</span>
          <div class="qp-btn"><svg width="13" height="13" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
        </div>`).join('');
      quickEl.querySelectorAll('.quick-item').forEach((el,i)=>el.addEventListener('click', items[i].action));
    }

    // Bento
    if (show('bento')) {
      const cells = [];
      if (recentTracks[0]) {
        const t=recentTracks[0];
        cells.push({label:'Recently Played',name:t.name,sub:t.artists.map(a=>a.name).join(', '),img:API.imgUrl(t.album?.images,640),action:()=>Player.playTrack(t.uri)});
      }
      featuredPls.slice(0,4).forEach(p=>cells.push({label:'Featured',name:p.name,sub:p.description||`${p.tracks?.total||''} songs`,img:API.imgUrl(p.images,300),action:()=>App.navigate('playlist',p.id)}));
      recentTracks.slice(1,5).forEach(t=>cells.push({label:'Track',name:t.name,sub:t.artists.map(a=>a.name).join(', '),img:API.imgUrl(t.album?.images,300),action:()=>Player.playTrack(t.uri)}));
      const grid=[{col:'1',row:'1/3'},{col:'2',row:'1'},{col:'3',row:'1'},{col:'2',row:'2'},{col:'3',row:'2'}];
      bentoEl.innerHTML = cells.slice(0,5).map((c,i)=>`
        <div class="bc${i===0?' bc-hero':''}" style="grid-column:${grid[i].col};grid-row:${grid[i].row}">
          ${c.img?`<img class="bc-img" src="${API.esc(c.img)}" alt="" loading="lazy"/>` :''}
          <div class="bc-grad"></div>
          <div class="bc-info">
            <div class="bc-lbl">${API.esc(c.label)}</div>
            <div class="bc-name">${API.esc(c.name)}</div>
            ${c.sub?`<div class="bc-sub">${API.esc(c.sub)}</div>`:''}
          </div>
          <div class="bc-play"><svg width="17" height="17" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
        </div>`).join('');
      bentoEl.querySelectorAll('.bc').forEach((el,i)=>{ if(cells[i]) el.addEventListener('click',cells[i].action); });
    }

    // Dynamic sections
    const sections = [];

    if (show('discover')||show('daily')) {
      const allPls = await API.myPlaylists(50);
      const myPls  = allPls?.items || [];

      if (show('discover')) {
        // Works in any language — "Discover Weekly" / "Ontdek de week" / etc.
        // Spotify always owns these playlists with owner spotify
        const dw = myPls.find(p =>
          p.owner?.id === 'spotify' &&
          (p.name?.toLowerCase().includes('discover') ||
           p.name?.toLowerCase().includes('ontdek') ||
           p.name?.toLowerCase().includes('weekly') ||
           p.name?.toLowerCase().includes('week'))
        );
        const rr = myPls.find(p =>
          p.owner?.id === 'spotify' &&
          (p.name?.toLowerCase().includes('release') ||
           p.name?.toLowerCase().includes('radar') ||
           p.name?.toLowerCase().includes('nieuw'))
        );
        const spotifyPls = [dw, rr].filter(Boolean);
        if (spotifyPls.length) sections.push({title:'Your Weekly Mix', items: spotifyPls, type:'card-row'});
      }

      if (show('daily')) {
        // Daily mixes — match localized: "Daily Mix 1" / "Dagelijkse mix 1" / etc.
        const dm = myPls.filter(p =>
          p.owner?.id === 'spotify' && (
            /daily mix/i.test(p.name) ||
            /dagelijkse mix/i.test(p.name) ||
            /mix du jour/i.test(p.name) ||
            /täglicher mix/i.test(p.name) ||
            /mezcla diaria/i.test(p.name) ||
            /mix \d/i.test(p.name)
          )
        ).slice(0, 6);
        if (dm.length) sections.push({title:'Daily Mixes', items: dm, type:'card-row'});
      }

      // Spotify-curated "Made for you" type playlists
      const madeForYou = myPls.filter(p =>
        p.owner?.id === 'spotify' && (
          /on repeat/i.test(p.name) ||
          /repeat rewind/i.test(p.name) ||
          /time capsule/i.test(p.name) ||
          /summer rewind/i.test(p.name) ||
          /your top songs/i.test(p.name) ||
          /jouw top/i.test(p.name)
        )
      ).slice(0, 4);
      if (madeForYou.length) sections.push({title:'Made For You', items: madeForYou, type:'card-row'});
    }

    if (show('toptracks')&&topTracks?.items?.length) {
      sections.push({title:'Your Top Tracks',items:topTracks.items,type:'tracklist',period:true});
    }
    if (show('topartists')&&topArtists?.items?.length) {
      sections.push({title:'Your Top Artists',items:topArtists.items,type:'artist-row'});
    }
    if (show('newreleases')&&newRel?.albums?.items?.length) {
      sections.push({title:'New Releases',items:newRel.albums.items,type:'album-row'});
    }
    if (show('recent')&&recentTracks.length) {
      sections.push({title:'Recently Played',items:recentTracks.slice(0,8),type:'tracklist'});
    }

    secEl.innerHTML = '';
    sections.forEach(sec => {
      const div = document.createElement('section');
      div.className = 'home-sec';
      div.innerHTML = `
        <div class="sec-row">
          <h2 class="sec-title">${API.esc(sec.title)}</h2>
          ${sec.period?`<div class="period-tabs">
            <button class="period-tab active" data-r="medium_term">6 months</button>
            <button class="period-tab" data-r="short_term">4 weeks</button>
            <button class="period-tab" data-r="long_term">All time</button>
          </div>`:''}
        </div>
        <div class="sec-body"></div>`;
      secEl.appendChild(div);
      const bodyEl = div.querySelector('.sec-body');

      if (sec.type==='tracklist') {
        renderTrackList(bodyEl, sec.items, null, true);
        if (sec.period) {
          div.querySelectorAll('.period-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
              div.querySelectorAll('.period-tab').forEach(t=>t.classList.remove('active'));
              tab.classList.add('active');
              bodyEl.innerHTML=`<div style="padding:8px 0;color:var(--i3)"><div class="ld"><span></span><span></span><span></span></div></div>`;
              const t = await API.topTracks(10, tab.dataset.r);
              renderTrackList(bodyEl, t?.items||[], null, true);
            });
          });
        }
      } else if (sec.type==='card-row') {
        bodyEl.innerHTML=`<div class="card-row stagger">${sec.items.map(p=>{
          const img=API.imgUrl(p.images,200);
          return `<div class="mcard" data-id="${p.id}">
            ${img?`<img class="mcard-img" src="${img}" alt="" loading="lazy"/>` :'<div class="mcard-img"></div>'}
            <div class="mc-body"><div class="mc-name">${API.esc(p.name)}</div><div class="mc-sub">${API.esc(p.description||'Playlist')}</div></div>
            <div class="mc-play"><svg width="15" height="15" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
          </div>`;
        }).join('')}</div>`;
        bodyEl.querySelectorAll('.mcard').forEach((el,i)=>el.addEventListener('click',()=>App.navigate('playlist',sec.items[i].id)));
      } else if (sec.type==='artist-row') {
        bodyEl.innerHTML=`<div class="card-row stagger">${sec.items.map(a=>{
          const img=API.imgUrl(a.images,200);
          return `<div class="mcard" data-id="${a.id}">
            ${img?`<img class="mcard-img mcard-img-r" src="${img}" alt="" loading="lazy"/>` :'<div class="mcard-img mcard-img-r"></div>'}
            <div class="mc-body"><div class="mc-name">${API.esc(a.name)}</div><div class="mc-sub">${(a.followers?.total||0).toLocaleString()} followers</div></div>
            <div class="mc-play"><svg width="15" height="15" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
          </div>`;
        }).join('')}</div>`;
        bodyEl.querySelectorAll('.mcard').forEach((el,i)=>el.addEventListener('click',()=>App.navigate('artist',sec.items[i].id)));
      } else if (sec.type==='album-row') {
        bodyEl.innerHTML=`<div class="card-row stagger">${sec.items.map(a=>{
          const img=API.imgUrl(a.images,200);
          return `<div class="mcard" data-id="${a.id}">
            ${img?`<img class="mcard-img" src="${img}" alt="" loading="lazy"/>` :'<div class="mcard-img"></div>'}
            <div class="mc-body"><div class="mc-name">${API.esc(a.name)}</div><div class="mc-sub">${API.esc(a.artists?.map(x=>x.name).join(', '))} · ${a.release_date?.slice(0,4)||''}</div></div>
            <div class="mc-play"><svg width="15" height="15" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
          </div>`;
        }).join('')}</div>`;
        bodyEl.querySelectorAll('.mcard').forEach((el,i)=>el.addEventListener('click',()=>App.navigate('album',sec.items[i].id)));
      }
    });
  }

  function trackRow(track, idx, contextUri, showAlbum=true) {
    if (!track) return '';
    const img     = API.imgUrl(track.album?.images, 60);
    const artists = (track.artists||[]).map(a=>`<span class="alink" data-id="${a.id}">${API.esc(a.name)}</span>`).join(', ');
    return `<div class="tr" data-uri="${track.uri||''}" data-idx="${idx}">
      <div class="tr-num">${idx+1}</div>
      <div class="tr-eq"><span class="eq-b"></span><span class="eq-b"></span><span class="eq-b"></span></div>
      <div class="tr-pb"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg></div>
      ${img?`<img class="tr-thumb" src="${img}" alt="" loading="lazy"/>` :'<div class="tr-thumb"></div>'}
      <div class="tr-info"><div class="tr-name">${API.esc(track.name)}</div><div class="tr-sub">${artists}</div></div>
      ${showAlbum?`<div class="tr-album">${API.esc(track.album?.name||'')}</div>`:'<div></div>'}
      <div class="tr-dur">${API.ms2t(track.duration_ms||0)}</div>
      <button class="tr-more" data-tid="${track.id||''}" data-turi="${track.uri||''}" data-name="${API.esc(track.name||'')}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>
    </div>`;
  }

  function renderTrackList(container, tracks, contextUri, showAlbum=true) {
    container.innerHTML = `<div class="stagger">${tracks.map((t,i)=>trackRow(t,i,contextUri,showAlbum)).join('')}</div>`;
    attachTrackEvents(container, tracks, contextUri);
  }

  function attachTrackEvents(container, tracks, contextUri) {
    container.querySelectorAll('.tr').forEach((row,i) => {
      row.addEventListener('click', e => {
        if(e.target.closest('.tr-more')||e.target.closest('.alink')) return;
        if(tracks[i]) Player.playTrack(tracks[i].uri, contextUri, i);
      });
    });
    container.querySelectorAll('.tr-more').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        App.showCtxMenu(e, btn.dataset.tid, btn.dataset.turi, btn.dataset.name);
      });
    });
    container.querySelectorAll('.alink').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); App.navigate('artist', el.dataset.id); });
    });
  }

  return { render, trackRow, renderTrackList, attachTrackEvents };
})();
