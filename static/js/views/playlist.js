/* views/playlist.js */
const PlaylistView = (() => {
  let _currentCtx = null, _currentTracks = [], _currentType = null, _currentId = null;

  async function render(type, id) {
    _currentType = type; _currentId = id;
    const hero = document.getElementById('pl-hero');
    const body = document.getElementById('pl-body');
    hero.innerHTML = `<div class="pl-bg"></div><div class="pl-vg"></div><div style="position:relative;z-index:1;padding:40px;color:var(--i3)"><div class="ld"><span></span><span></span><span></span></div></div>`;
    body.innerHTML = '';

    let title, sub, img, contextUri, tracks, description = '';
    let isOwn = false, albumId = null;

    if (type === 'liked') {
      title = 'Liked Songs'; sub = 'Your saved tracks'; img = '';
      contextUri = 'spotify:collection:tracks';
      const d = await API.likedSongs(50);
      tracks = (d?.items||[]).map(i=>i.track).filter(Boolean);

    } else if (type === 'playlist') {
      const d = await API.playlist(id);
      if (!d) { hero.innerHTML = '<div class="empty-msg" style="padding:48px">Not found.</div>'; return; }
      title = d.name; description = d.description || '';
      sub = `${d.owner?.display_name||''} · ${d.tracks?.total||0} songs`;
      img = API.imgUrl(d.images, 250); contextUri = d.uri;
      tracks = (d.tracks?.items||[]).map(i=>i.track).filter(Boolean);
      isOwn = d.owner?.id === App.getUserId();

    } else if (type === 'album') {
      const d = await API.album(id);
      if (!d) { hero.innerHTML = '<div class="empty-msg" style="padding:48px">Not found.</div>'; return; }
      title = d.name;
      sub = `${d.artists?.map(a=>a.name).join(', ')} · ${d.release_date?.slice(0,4)||''} · ${d.total_tracks} tracks`;
      img = API.imgUrl(d.images, 250); contextUri = d.uri;
      tracks = (d.tracks?.items||[]).map(t => ({...t, album:d}));
      albumId = id;
    }

    _currentTracks = tracks; _currentCtx = contextUri;

    // Hero
    hero.innerHTML = `
      <div class="pl-bg" style="background-image:url(${img||''})"></div>
      <div class="pl-vg"></div>
      ${img
        ? `<img class="pl-art" src="${img}" alt="" style="position:relative;z-index:1"/>`
        : `<div class="pl-art" style="background:linear-gradient(135deg,#450af5,#c4efd9);display:flex;align-items:center;justify-content:center;font-size:80px;position:relative;z-index:1">♥</div>`}
      <div class="pl-meta fade-in">
        <div class="pl-type">${type==='album'?'Album':'Playlist'}</div>
        <div class="pl-title">${API.esc(title)}</div>
        ${description ? `<div class="pl-sub" style="margin-top:4px;font-size:12px;max-width:400px">${API.esc(description)}</div>` : ''}
        <div class="pl-sub">${API.esc(sub)}</div>
        <div class="pl-acts">
          <button class="pl-play-btn" id="pl-play">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg> Play
          </button>
          <button class="pl-shuf-btn" id="pl-shuf">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="4" y1="4" x2="9" y2="9"/></svg> Shuffle
          </button>
          ${albumId ? `<button class="pl-shuf-btn" id="pl-save-album">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Save Album
          </button>` : ''}
          ${type==='playlist' && isOwn ? `<button class="pl-shuf-btn" id="pl-add-tracks">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add tracks
          </button>` : ''}
        </div>
      </div>`;

    // Search bar inside hero
    const searchWrap = document.createElement('div');
    searchWrap.className = 'pl-search-wrap';
    searchWrap.style.cssText = 'position:relative;z-index:1;margin-top:auto;margin-left:auto;align-self:flex-end';
    searchWrap.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input class="pl-search" id="pl-search" type="text" placeholder="Search in ${API.esc(title)}…" autocomplete="off"/>`;
    hero.querySelector('.pl-meta')?.parentNode.appendChild(searchWrap);

    document.getElementById('pl-play')?.addEventListener('click', () => Player.playContext(contextUri, 0));
    document.getElementById('pl-shuf')?.addEventListener('click', async () => { await API.setShuffle(true); Player.playContext(contextUri); });
    document.getElementById('pl-save-album')?.addEventListener('click', async () => {
      await API.saveAlbum([albumId]);
      App.toast('Album saved to library', 'ok');
    });
    document.getElementById('pl-add-tracks')?.addEventListener('click', () => App.openSpotlight());

    // In-playlist search
    document.getElementById('pl-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = q ? tracks.filter(t => t.name.toLowerCase().includes(q) || t.artists?.some(a=>a.name.toLowerCase().includes(q))) : tracks;
      renderTracks(body, filtered, contextUri, type !== 'album', type === 'playlist' && isOwn, id);
    });

    // Render tracks
    if (!tracks.length) {
      body.innerHTML = '<div class="empty-msg" style="padding:24px 40px">No tracks found.</div>';
      return;
    }
    renderTracks(body, tracks, contextUri, type !== 'album', type === 'playlist' && isOwn, id);
  }

  function renderTracks(body, tracks, contextUri, showAlbum, canRemove, playlistId) {
    body.innerHTML = `<div class="tlist-hd">
      <span>#</span><span></span><span>Title</span>
      ${showAlbum ? '<span>Album</span>' : '<span></span>'}
      <span>Time</span><span></span>
    </div>`;
    const listEl = document.createElement('div');
    listEl.className = 'tlist stagger';
    listEl.innerHTML = tracks.map((t, i) => HomeView.trackRow(t, i, contextUri, showAlbum)).join('');
    body.appendChild(listEl);
    HomeView.attachTrackEvents(listEl, tracks, contextUri);

    // Add "remove from playlist" to context menu for owned playlists
    if (canRemove && playlistId) {
      listEl.querySelectorAll('.tr-more').forEach((btn, i) => {
        btn.dataset.plid = playlistId;
        btn.dataset.plidx = i;
      });
    }
  }

  function getCurrentContext() { return { contextUri:_currentCtx, tracks:_currentTracks, type:_currentType, id:_currentId }; }

  return { render, getCurrentContext };
})();
