/* views/search.js — full inline search view */
const SearchView = (() => {
  let _deb = null;
  let _recent = (() => { try { return JSON.parse(localStorage.getItem('ms_recent')||'[]'); } catch { return []; } })();

  function saveRecent(q) {
    _recent = [q, ..._recent.filter(x=>x!==q)].slice(0,10);
    localStorage.setItem('ms_recent', JSON.stringify(_recent));
  }

  function init() {
    const input = document.getElementById('search-input');
    const results= document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', ()=>{
      const q = input.value.trim();
      clearTimeout(_deb);
      if (!q) { renderIdle(results); return; }
      _deb = setTimeout(()=>doSearch(q, results), 220);
    });

    input.addEventListener('keydown', e=>{
      if (e.key==='Escape') { input.value=''; renderIdle(results); }
    });
  }

  function onShow() {
    // Called when search view becomes active
    const input   = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (input) { setTimeout(()=>input.focus(), 80); }
    if (results) renderIdle(results);
  }

  function renderIdle(results) {
    if (!_recent.length) {
      results.innerHTML = '<div class="empty-msg">Start typing to search for songs, artists and albums.</div>';
      return;
    }
    results.innerHTML = `
      <div class="sp-sect">
        <span class="sp-sect-lbl">Recent Searches</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${_recent.map(q=>`
            <div class="recent-chip" data-q="${API.esc(q)}" style="display:flex;align-items:center;gap:8px;background:var(--g2);border:1px solid var(--l1);border-radius:var(--rF);padding:7px 14px;font-size:13px;cursor:pointer;transition:background .12s">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              ${API.esc(q)}
              <span class="chip-del" data-del="${API.esc(q)}" style="color:var(--i3);cursor:pointer">✕</span>
            </div>`).join('')}
        </div>
      </div>`;

    results.querySelectorAll('.recent-chip').forEach(chip=>{
      chip.addEventListener('click', e=>{
        if (e.target.closest('.chip-del')) return;
        const input = document.getElementById('search-input');
        if (input) { input.value = chip.dataset.q; }
        doSearch(chip.dataset.q, results);
      });
    });
    results.querySelectorAll('.chip-del').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        _recent = _recent.filter(x=>x!==btn.dataset.del);
        localStorage.setItem('ms_recent', JSON.stringify(_recent));
        renderIdle(results);
      });
    });
  }

  async function doSearch(q, results) {
    results.innerHTML = '<div class="empty-msg"><div class="ld"><span></span><span></span><span></span></div></div>';
    saveRecent(q);
    const data = await API.search(q, ['track','artist','album','playlist'], 8);
    if (!data) { results.innerHTML = '<div class="empty-msg">No results found</div>'; return; }
    renderResults(data, results);
  }

  function renderResults(data, results) {
    const e = API.esc;
    let html = '';

    // Top result
    const topTrack  = data.tracks?.items?.[0];
    const topArtist = data.artists?.items?.[0];
    const top = (topArtist?.popularity||0) > 55 ? topArtist : topTrack;
    if (top) {
      const isA = top.type==='artist';
      const img = API.imgUrl(isA?top.images:top.album?.images, 96);
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Top Result</span>
        <div class="sp-item" data-type="${top.type}" data-id="${top.id}" data-uri="${top.uri||''}">
          ${img?`<img class="sp-art ${isA?'sp-art-r':''}" src="${img}" alt="" style="width:52px;height:52px"/>` :`<div class="sp-art ${isA?'sp-art-r':''}" style="width:52px;height:52px"></div>`}
          <div class="sp-item-info">
            <div class="sp-item-name" style="font-size:16px;font-weight:700">${e(top.name)}</div>
            <div class="sp-item-sub">${e(isA?`${(top.followers?.total||0).toLocaleString()} followers`:top.artists?.map(a=>a.name).join(', '))}</div>
          </div>
          <span class="sp-badge">${top.type}</span>
        </div></div>`;
    }

    const tracks  = data.tracks?.items?.slice(0,5)||[];
    const artists = data.artists?.items?.slice(0,3)||[];
    const albums  = data.albums?.items?.slice(0,3)||[];

    if (tracks.length) {
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Songs</span>`;
      tracks.forEach(t=>{
        const img=API.imgUrl(t.album?.images,42);
        html+=`<div class="sp-item" data-type="track" data-uri="${t.uri}" data-id="${t.id}">
          ${img?`<img class="sp-art" src="${img}" alt=""/>` :'<div class="sp-art"></div>'}
          <div class="sp-item-info"><div class="sp-item-name">${e(t.name)}</div><div class="sp-item-sub">${e(t.artists?.map(a=>a.name).join(', '))} · ${e(t.album?.name||'')}</div></div>
          <span class="sp-badge">song</span></div>`;
      });
      html += '</div>';
    }
    if (artists.length) {
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Artists</span>`;
      artists.forEach(a=>{
        const img=API.imgUrl(a.images,42);
        html+=`<div class="sp-item" data-type="artist" data-id="${a.id}">
          ${img?`<img class="sp-art sp-art-r" src="${img}" alt=""/>` :'<div class="sp-art sp-art-r"></div>'}
          <div class="sp-item-info"><div class="sp-item-name">${e(a.name)}</div><div class="sp-item-sub">${(a.followers?.total||0).toLocaleString()} followers</div></div>
          <span class="sp-badge">artist</span></div>`;
      });
      html += '</div>';
    }
    if (albums.length) {
      html += `<div class="sp-sect"><span class="sp-sect-lbl">Albums</span>`;
      albums.forEach(a=>{
        const img=API.imgUrl(a.images,42);
        html+=`<div class="sp-item" data-type="album" data-id="${a.id}">
          ${img?`<img class="sp-art" src="${img}" alt=""/>` :'<div class="sp-art"></div>'}
          <div class="sp-item-info"><div class="sp-item-name">${e(a.name)}</div><div class="sp-item-sub">${e(a.artists?.map(x=>x.name).join(', '))} · ${a.release_date?.slice(0,4)||''}</div></div>
          <span class="sp-badge">album</span></div>`;
      });
      html += '</div>';
    }

    if (!html) html = '<div class="empty-msg">No results found</div>';
    results.innerHTML = html;

    results.querySelectorAll('.sp-item').forEach(item=>{
      item.addEventListener('click', ()=>{
        const {type,id,uri}=item.dataset;
        if (type==='track'&&uri) { Player.playTrack(uri); return; }
        if (type==='artist')  App.navigate('artist',id);
        else if (type==='album')    App.navigate('album',id);
        else if (type==='playlist') App.navigate('playlist',id);
      });
    });
  }

  return { init, onShow };
})();
