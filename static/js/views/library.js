/* views/library.js */
const LibraryView = (() => {
  let _tab = 'playlists', _filter = '';

  function init() {
    document.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); _tab = btn.dataset.tab; render();
      });
    });
    document.getElementById('lib-search')?.addEventListener('input', e => {
      _filter = e.target.value.toLowerCase();
      render();
    });
    document.getElementById('lib-sort')?.addEventListener('change', () => render());
    document.getElementById('lib-new-btn')?.addEventListener('click', () => App.openNewPlaylist());
  }

  async function render() {
    const c = document.getElementById('lib-content');
    const sort = document.getElementById('lib-sort')?.value || 'recent';
    c.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:16px 0;color:var(--i3)"><div class="ld"><span></span><span></span><span></span></div></div>`;

    if (_tab === 'playlists') {
      const d = await API.myPlaylists(50);
      let items = d?.items || [];
      if (_filter) items = items.filter(p => p.name.toLowerCase().includes(_filter));
      if (sort === 'alpha') items = [...items].sort((a,b) => a.name.localeCompare(b.name));
      c.innerHTML = !items.length ? '<div class="empty-msg">No playlists found.</div>' :
        `<div class="lib-list stagger">${items.map(p => {
          const img = API.imgUrl(p.images, 60);
          return `<div class="lib-row" data-id="${p.id}">
            ${img ? `<img class="lib-art" src="${img}" alt="" loading="lazy"/>` : '<div class="lib-art"></div>'}
            <div class="lib-info"><div class="lib-name">${API.esc(p.name)}</div><div class="lib-sub">Playlist · ${p.tracks?.total||0} songs</div></div>
          </div>`;
        }).join('')}</div>`;
      c.querySelectorAll('.lib-row').forEach((row, i) => row.addEventListener('click', () => App.navigate('playlist', items[i].id)));

    } else if (_tab === 'albums') {
      const d = await API.myAlbums(50);
      let items = (d?.items||[]).map(i=>i.album);
      if (_filter) items = items.filter(a => a.name.toLowerCase().includes(_filter) || a.artists?.some(x=>x.name.toLowerCase().includes(_filter)));
      if (sort === 'alpha') items = [...items].sort((a,b) => a.name.localeCompare(b.name));
      c.innerHTML = !items.length ? '<div class="empty-msg">No saved albums.</div>' :
        `<div class="lib-list stagger">${items.map(a => {
          const img = API.imgUrl(a.images, 60);
          return `<div class="lib-row" data-id="${a.id}">
            ${img ? `<img class="lib-art" src="${img}" alt="" loading="lazy"/>` : '<div class="lib-art"></div>'}
            <div class="lib-info"><div class="lib-name">${API.esc(a.name)}</div><div class="lib-sub">Album · ${API.esc(a.artists?.map(x=>x.name).join(', '))}</div></div>
          </div>`;
        }).join('')}</div>`;
      c.querySelectorAll('.lib-row').forEach((row, i) => row.addEventListener('click', () => App.navigate('album', items[i].id)));

    } else if (_tab === 'artists') {
      const d = await API.myArtists();
      let items = d?.artists?.items || [];
      if (_filter) items = items.filter(a => a.name.toLowerCase().includes(_filter));
      if (sort === 'alpha') items = [...items].sort((a,b) => a.name.localeCompare(b.name));
      c.innerHTML = !items.length ? '<div class="empty-msg">No followed artists.</div>' :
        `<div class="lib-list stagger">${items.map(a => {
          const img = API.imgUrl(a.images, 60);
          return `<div class="lib-row" data-id="${a.id}">
            ${img ? `<img class="lib-art lib-art-r" src="${img}" alt="" loading="lazy"/>` : '<div class="lib-art lib-art-r"></div>'}
            <div class="lib-info"><div class="lib-name">${API.esc(a.name)}</div><div class="lib-sub">${(a.followers?.total||0).toLocaleString()} followers</div></div>
          </div>`;
        }).join('')}</div>`;
      c.querySelectorAll('.lib-row').forEach((row, i) => row.addEventListener('click', () => App.navigate('artist', items[i].id)));
    }
  }

  return { init, render };
})();
