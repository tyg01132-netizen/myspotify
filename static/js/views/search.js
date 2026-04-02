/* views/search.js */
const SearchView = (() => {
  let _deb = null;
  let _recent = (() => { try { return JSON.parse(localStorage.getItem('ms_search_recent') || '[]'); } catch { return []; } })();

  function save(q) {
    _recent = [q, ..._recent.filter(x => x !== q)].slice(0, 8);
    localStorage.setItem('ms_search_recent', JSON.stringify(_recent));
  }

  function init() {
    const input   = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(_deb);
      if (!q) { renderIdle(results); return; }
      _deb = setTimeout(() => doSearch(q, results), 250);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { input.value = ''; renderIdle(results); }
    });
  }

  function onShow() {
    const input   = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (input) setTimeout(() => input.focus(), 80);
    if (results && !input?.value) renderIdle(results);
  }

  function renderIdle(results) {
    if (!_recent.length) {
      results.innerHTML = '<div class="empty-msg" style="margin-top:8px">Search for any song, artist or album.</div>';
      return;
    }
    results.innerHTML = `
      <div class="sp-sect">
        <span class="sp-sect-lbl">Recent searches</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${_recent.map(q => `
            <div class="recent-chip" data-q="${API.esc(q)}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              ${API.esc(q)}
              <span class="chip-x" data-del="${API.esc(q)}">✕</span>
            </div>`).join('')}
        </div>
      </div>`;
    results.querySelectorAll('.recent-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        if (e.target.closest('.chip-x')) return;
        const input = document.getElementById('search-input');
        if (input) { input.value = chip.dataset.q; }
        doSearch(chip.dataset.q, results);
      });
    });
    results.querySelectorAll('.chip-x').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _recent = _recent.filter(x => x !== btn.dataset.del);
        localStorage.setItem('ms_search_recent', JSON.stringify(_recent));
        renderIdle(results);
      });
    });
  }

  async function doSearch(q, results) {
    results.innerHTML = `<div style="padding:16px 0;color:var(--i3)"><div class="ld"><span></span><span></span><span></span></div></div>`;
    save(q);

    // Search tracks, artists, albums AND playlists
    const data = await API.search(q, ['track', 'artist', 'album', 'playlist'], 10);
    if (!data) {
      results.innerHTML = '<div class="empty-msg">No results found.</div>';
      return;
    }
    render(data, q, results);
  }

  function render(data, q, results) {
    const e = API.esc;
    let html = '';

    const tracks   = data.tracks?.items?.filter(Boolean) || [];
    const artists  = data.artists?.items?.filter(Boolean) || [];
    const albums   = data.albums?.items?.filter(Boolean) || [];
    const playlists= data.playlists?.items?.filter(Boolean) || [];

    // Best match
    const topArtist = artists.find(a => a.popularity > 50);
    const top = topArtist || tracks[0] || albums[0];
    if (top) {
      const isA = top.type === 'artist';
      const isAl = top.type === 'album';
      const img = API.imgUrl(isA ? top.images : top.album?.images || top.images, 96);
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Best result</span>
        <div class="sp-top-hit" data-type="${top.type}" data-id="${top.id}" data-uri="${top.uri||''}">
          ${img ? `<img class="sp-top-img ${isA?'sp-art-r':''}" src="${img}" alt=""/>` : `<div class="sp-top-img ${isA?'sp-art-r':''}"></div>`}
          <div class="sp-top-info">
            <div class="sp-top-name">${e(top.name)}</div>
            <div class="sp-top-sub">${e(isA ? `${(top.followers?.total||0).toLocaleString()} followers` : isAl ? `Album · ${top.artists?.map(a=>a.name).join(', ')}` : top.artists?.map(a=>a.name).join(', '))}</div>
            <span class="sp-badge">${top.type}</span>
          </div>
        </div>
      </div>`;
    }

    if (tracks.length) {
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Songs</span>`;
      tracks.slice(0, 6).forEach(t => {
        const img = API.imgUrl(t.album?.images, 44);
        html += `<div class="sp-item" data-type="track" data-uri="${t.uri}" data-id="${t.id}">
          ${img ? `<img class="sp-art" src="${img}" alt=""/>` : '<div class="sp-art"></div>'}
          <div class="sp-item-info">
            <div class="sp-item-name">${e(t.name)}</div>
            <div class="sp-item-sub">${e(t.artists?.map(a=>a.name).join(', '))} · ${e(t.album?.name||'')}</div>
          </div>
          <div class="sp-dur">${API.ms2t(t.duration_ms||0)}</div>
          <button class="sp-q-btn" data-uri="${t.uri}" title="Add to queue">+Q</button>
        </div>`;
      });
      html += `</div>`;
    }

    if (artists.length) {
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Artists</span>`;
      artists.slice(0, 4).forEach(a => {
        const img = API.imgUrl(a.images, 44);
        html += `<div class="sp-item" data-type="artist" data-id="${a.id}">
          ${img ? `<img class="sp-art sp-art-r" src="${img}" alt=""/>` : '<div class="sp-art sp-art-r"></div>'}
          <div class="sp-item-info">
            <div class="sp-item-name">${e(a.name)}</div>
            <div class="sp-item-sub">${(a.followers?.total||0).toLocaleString()} followers · ${a.genres?.slice(0,2).join(', ')||'Artist'}</div>
          </div>
          <span class="sp-badge">artist</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (albums.length) {
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Albums</span>`;
      albums.slice(0, 5).forEach(a => {
        const img = API.imgUrl(a.images, 44);
        html += `<div class="sp-item" data-type="album" data-id="${a.id}">
          ${img ? `<img class="sp-art" src="${img}" alt=""/>` : '<div class="sp-art"></div>'}
          <div class="sp-item-info">
            <div class="sp-item-name">${e(a.name)}</div>
            <div class="sp-item-sub">${e(a.artists?.map(x=>x.name).join(', '))} · ${a.release_date?.slice(0,4)||''} · ${a.total_tracks} tracks</div>
          </div>
          <span class="sp-badge">album</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (playlists.length) {
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Playlists</span>`;
      playlists.slice(0, 4).forEach(p => {
        const img = API.imgUrl(p.images, 44);
        html += `<div class="sp-item" data-type="playlist" data-id="${p.id}">
          ${img ? `<img class="sp-art" src="${img}" alt=""/>` : '<div class="sp-art"></div>'}
          <div class="sp-item-info">
            <div class="sp-item-name">${e(p.name)}</div>
            <div class="sp-item-sub">${e(p.owner?.display_name||'')} · ${p.tracks?.total||0} songs</div>
          </div>
          <span class="sp-badge">playlist</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (!html) html = '<div class="empty-msg">No results found.</div>';
    results.innerHTML = html;

    // Top hit click
    results.querySelector('.sp-top-hit')?.addEventListener('click', function() {
      const { type, id, uri } = this.dataset;
      if (type === 'track' && uri) { Player.playTrack(uri); return; }
      if (type === 'artist')  App.navigate('artist', id);
      else if (type === 'album')    App.navigate('album', id);
      else if (type === 'playlist') App.navigate('playlist', id);
    });

    results.querySelectorAll('.sp-item').forEach(item => {
      item.addEventListener('click', () => {
        const { type, id, uri } = item.dataset;
        if (type === 'track') {
          if (uri) Player.playTrack(uri);
          return;
        }
        if (type === 'artist')        App.navigate('artist', id);
        else if (type === 'album')    App.navigate('album', id);
        else if (type === 'playlist') App.navigate('playlist', id);
      });
    });

    // Queue buttons in search results
    results.querySelectorAll('.sp-q-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await API.addToQueue(btn.dataset.uri);
        App.toast('Added to queue ✓', 'ok');
      });
    });
  }

  return { init, onShow };
})();
