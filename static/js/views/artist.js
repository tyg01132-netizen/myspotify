/* views/artist.js */
const ArtistView = (() => {

  async function render(id) {
    const heroEl = document.getElementById('art-hero');
    const bodyEl = document.getElementById('art-body');
    heroEl.innerHTML = `<div style="height:310px;background:linear-gradient(135deg,var(--b2),var(--b1))"></div>`;
    bodyEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:var(--i3);padding:24px 0"><div class="ld"><span></span><span></span><span></span></div></div>`;

    const [art, topTracksData, albumsData, relatedData] = await Promise.all([
      API.artist(id),
      API.artistTopTracks(id),
      API.artistAlbums(id),
      API.artistRelated(id),
    ]);
    if (!art) { bodyEl.innerHTML = '<div class="empty-msg">Artist not found.</div>'; return; }

    const img = API.imgUrl(art.images, 640);
    const e = API.esc;
    const followers = (art.followers?.total || 0).toLocaleString();
    const popularity = art.popularity || 0;

    let isFollowing = false;
    try { const fc = await API.checkFollow('artist', [id]); isFollowing = fc?.[0] || false; } catch {}

    heroEl.innerHTML = `
      ${img ? `<img class="art-img" src="${img}" alt="" loading="lazy"/>` : '<div class="art-img" style="background:linear-gradient(135deg,#1a1a2e,#16213e)"></div>'}
      <div class="art-ov fade-in">
        <div class="art-verified">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--blue)"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Verified Artist
        </div>
        <div class="art-name">${e(art.name)}</div>
        <div class="art-followers">
          <span>${followers} followers</span>
          <span style="margin:0 10px;opacity:.3">·</span>
          <span>${popularity}% popularity</span>
        </div>
        ${art.genres?.length ? `<div class="art-genres">${art.genres.slice(0,5).map(g=>`<span class="art-genre">${e(g)}</span>`).join('')}</div>` : ''}
        <div class="pl-acts" style="margin-top:16px">
          <button class="pl-play-btn" id="art-play-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg> Play
          </button>
          <button class="pl-shuf-btn" id="art-radio-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6s4-4 11-4 11 4 11 4"/><path d="M5 10s2-3 7-3 7 3 7 3"/><path d="M9 14s1-1 3-1 3 1 3 1"/></svg> Radio
          </button>
          <button class="pl-shuf-btn ${isFollowing?'following':''}" id="art-follow-btn">
            ${isFollowing ? '✓ Following' : '+ Follow'}
          </button>
        </div>
      </div>`;

    document.getElementById('art-play-btn')?.addEventListener('click', () => Player.playContext(art.uri));
    document.getElementById('art-radio-btn')?.addEventListener('click', async () => {
      App.toast('Starting artist radio…','info');
      const data = await API.recommendations({seed_artists:art.id,limit:25});
      if (!data?.tracks?.length) { App.toast('No radio available','err'); return; }
      await API.play(Player.getDeviceId(), {uris:data.tracks.map(t=>t.uri)});
      App.toast(`Radio: ${art.name}`,'ok');
    });
    const followBtn = document.getElementById('art-follow-btn');
    followBtn?.addEventListener('click', async () => {
      if (isFollowing) {
        await API.unfollow('artist',[id]); isFollowing=false;
        followBtn.textContent='+ Follow'; followBtn.classList.remove('following');
        App.toast(`Unfollowed ${art.name}`,'info');
      } else {
        await API.follow('artist',[id]); isFollowing=true;
        followBtn.textContent='✓ Following'; followBtn.classList.add('following');
        App.toast(`Following ${art.name}`,'ok');
      }
    });

    let html = '';

    // Popular tracks
    const tracks = topTracksData?.tracks?.slice(0,10) || [];
    if (tracks.length) {
      html += `<section class="home-sec">
        <div class="sec-row"><h2 class="sec-title">Popular</h2></div>
        <div class="tlist stagger">${tracks.map((t,i)=>HomeView.trackRow(t,i,art.uri,false)).join('')}</div>
      </section>`;
    }

    // Albums + singles with type badges
    const albs = albumsData?.items || [];
    if (albs.length) {
      const albumsOnly  = albs.filter(a=>a.album_type==='album');
      const singlesOnly = albs.filter(a=>a.album_type==='single');

      if (albumsOnly.length) {
        html += `<section class="home-sec">
          <div class="sec-row"><h2 class="sec-title">Albums</h2></div>
          <div class="card-row stagger">${albumsOnly.map(a=>{
            const img2=API.imgUrl(a.images,200);
            return `<div class="mcard" data-id="${a.id}">
              ${img2?`<img class="mcard-img" src="${img2}" alt="" loading="lazy"/>` :'<div class="mcard-img"></div>'}
              <div class="mc-body"><div class="mc-name">${e(a.name)}</div><div class="mc-sub">${a.release_date?.slice(0,4)||''} · Album</div></div>
              <div class="mc-play"><svg width="15" height="15" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
            </div>`;
          }).join('')}</div>
        </section>`;
      }

      if (singlesOnly.length) {
        html += `<section class="home-sec">
          <div class="sec-row"><h2 class="sec-title">Singles & EPs</h2></div>
          <div class="card-row stagger">${singlesOnly.map(a=>{
            const img2=API.imgUrl(a.images,200);
            return `<div class="mcard" data-id="${a.id}">
              ${img2?`<img class="mcard-img" src="${img2}" alt="" loading="lazy"/>` :'<div class="mcard-img"></div>'}
              <div class="mc-body"><div class="mc-name">${e(a.name)}</div><div class="mc-sub">${a.release_date?.slice(0,4)||''} · ${a.total_tracks===1?'Single':'EP'}</div></div>
              <div class="mc-play"><svg width="15" height="15" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
            </div>`;
          }).join('')}</div>
        </section>`;
      }
    }

    // Related artists
    const related = relatedData?.artists?.slice(0,8) || [];
    if (related.length) {
      html += `<section class="home-sec">
        <div class="sec-row"><h2 class="sec-title">Fans also like</h2></div>
        <div class="card-row stagger">${related.map(a=>{
          const img2=API.imgUrl(a.images,200);
          return `<div class="mcard" data-rel-id="${a.id}">
            ${img2?`<img class="mcard-img mcard-img-r" src="${img2}" alt="" loading="lazy"/>` :'<div class="mcard-img mcard-img-r"></div>'}
            <div class="mc-body"><div class="mc-name">${e(a.name)}</div><div class="mc-sub">${(a.followers?.total||0).toLocaleString()} followers</div></div>
            <div class="mc-play"><svg width="15" height="15" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21"/></svg></div>
          </div>`;
        }).join('')}</div>
      </section>`;
    }

    bodyEl.innerHTML = html;

    const tlist = bodyEl.querySelector('.tlist');
    if (tlist) HomeView.attachTrackEvents(tlist, tracks, art.uri);
    bodyEl.querySelectorAll('.mcard[data-id]').forEach((el,i)    => el.addEventListener('click',()=>App.navigate('album',  albs[i]?.id)));
    bodyEl.querySelectorAll('.mcard[data-rel-id]').forEach((el,i) => el.addEventListener('click',()=>App.navigate('artist', related[i]?.id)));
  }

  return { render };
})();
