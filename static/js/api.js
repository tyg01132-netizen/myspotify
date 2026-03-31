/* api.js – complete Spotify API layer */
const API = (() => {
  const BASE = 'https://api.spotify.com/v1';
  let _tok = null, _refreshP = null;

  async function getToken() {
    if (_tok) return _tok;
    try { const r = await fetch('/api/auth/token'); if (!r.ok) return null; _tok = (await r.json()).access_token; return _tok; }
    catch { return null; }
  }

  async function doRefresh() {
    try {
      const r = await fetch('/api/auth/refresh', { method:'POST' });
      if (!r.ok) { _tok = null; return false; }
      _tok = (await r.json()).access_token; return true;
    } catch { _tok = null; return false; }
  }

  async function refresh() {
    if (_refreshP) return _refreshP;
    _refreshP = doRefresh().finally(() => { _refreshP = null; });
    return _refreshP;
  }

  async function req(method, path, body) {
    let tok = await getToken(); if (!tok) return null;
    const h = { Authorization:`Bearer ${tok}`, 'Content-Type':'application/json' };
    const opts = { method, headers:h };
    if (body !== undefined) opts.body = JSON.stringify(body);
    let r = await fetch(BASE + path, opts);
    if (r.status === 401) {
      const ok = await refresh(); if (!ok) { window.App?.logout?.(); return null; }
      opts.headers.Authorization = `Bearer ${_tok}`;
      r = await fetch(BASE + path, opts);
    }
    if (r.status === 204 || r.status === 202) return {};
    if (!r.ok) return null;
    try { return await r.json(); } catch { return {}; }
  }

  const get = p => req('GET',p);
  const post = (p,b) => req('POST',p,b);
  const put = (p,b) => req('PUT',p,b);
  const del = (p,b) => req('DELETE',p,b);

  // User
  const me = () => get('/me');
  const topTracks = (n=20,r='medium_term') => get(`/me/top/tracks?limit=${n}&time_range=${r}`);
  const topArtists = (n=10,r='medium_term') => get(`/me/top/artists?limit=${n}&time_range=${r}`);
  const recentlyPlayed = (n=20) => get(`/me/player/recently-played?limit=${n}`);
  const userPlaylists = (userId) => get(`/users/${userId}/playlists`);

  // Library
  const myPlaylists = (n=50) => get(`/me/playlists?limit=${n}`);
  const myAlbums = (n=50) => get(`/me/albums?limit=${n}`);
  const myArtists = () => get('/me/following?type=artist&limit=50');
  const likedSongs = (n=50,off=0) => get(`/me/tracks?limit=${n}&offset=${off}`);
  const checkSaved = ids => get(`/me/tracks/contains?ids=${ids.join(',')}`);
  const saveTracks = ids => put('/me/tracks',{ids});
  const unsaveTracks = ids => del('/me/tracks',{ids});
  const checkAlbumSaved = ids => get(`/me/albums/contains?ids=${ids.join(',')}`);
  const saveAlbum = ids => put('/me/albums',{ids});
  const unsaveAlbum = ids => del('/me/albums',{ids});

  // Follow
  const checkFollow = (type,ids) => get(`/me/following/contains?type=${type}&ids=${ids.join(',')}`);
  const follow = (type,ids) => put(`/me/following?type=${type}`,{ids});
  const unfollow = (type,ids) => del(`/me/following?type=${type}`,{ids});

  // Playlists
  const playlist = id => get(`/playlists/${id}`);
  const playlistTracks = (id,n=50,off=0) => get(`/playlists/${id}/tracks?limit=${n}&offset=${off}`);
  const createPlaylist = (userId,name,desc) => post(`/users/${userId}/playlists`,{name,description:desc||'',public:false});
  const addToPlaylist = (id,uris) => post(`/playlists/${id}/tracks`,{uris});
  const removeFromPlaylist = (id,uris) => del(`/playlists/${id}/tracks`,{tracks:uris.map(u=>({uri:u}))});
  const updatePlaylist = (id,data) => put(`/playlists/${id}`,data);

  // Albums / Artists
  const album = id => get(`/albums/${id}`);
  const artist = id => get(`/artists/${id}`);
  const artistTopTracks = id => get(`/artists/${id}/top-tracks?market=from_token`);
  const artistAlbums = id => get(`/artists/${id}/albums?limit=10&include_groups=album,single`);
  const artistRelated = id => get(`/artists/${id}/related-artists`);

  // Search / Browse
  const search = (q,types,n=20) => get(`/search?q=${encodeURIComponent(q)}&type=${(types||['track','artist','album','playlist']).join(',')}&limit=${n}`);
  const categories = () => get('/browse/categories?limit=30');
  const featuredPlaylists = () => get('/browse/featured-playlists?limit=10');
  const newReleases = () => get('/browse/new-releases?limit=12');
  const recommendations = p => { const qs=Object.entries(p).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&'); return get(`/recommendations?${qs}`); };
  const audioFeatures = id => get(`/audio-features/${id}`);

  // Playback
  const playbackState = () => get('/me/player');
  const myDevices = () => get('/me/player/devices');
  const myQueue = () => get('/me/player/queue');
  const transferDevice = (id,play) => put('/me/player',{device_ids:[id],play:!!play});
  const play = (devId,body) => put(`/me/player/play${devId?`?device_id=${devId}`:''}`,body||{});
  const pause = () => put('/me/player/pause');
  const nextTrack = () => post('/me/player/next');
  const prevTrack = () => post('/me/player/previous');
  const seek = ms => put(`/me/player/seek?position_ms=${ms}`);
  const setVolume = v => put(`/me/player/volume?volume_percent=${v}`);
  const setShuffle = s => put(`/me/player/shuffle?state=${s}`);
  const setRepeat = s => put(`/me/player/repeat?state=${s}`);
  const addToQueue = uri => post(`/me/player/queue?uri=${encodeURIComponent(uri)}`);

  // Utils
  const clearToken = () => { _tok = null; };
  const ms2t = ms => { const s=Math.floor(ms/1000),m=Math.floor(s/60); return `${m}:${(s%60).toString().padStart(2,'0')}`; };
  const imgUrl = (imgs,size=300) => {
    if (!imgs?.length) return '';
    if (imgs.length===1) return imgs[0].url;
    return imgs.reduce((b,i)=>Math.abs((i.width||640)-size)<Math.abs((b.width||640)-size)?i:b).url;
  };
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  return {
    me, topTracks, topArtists, recentlyPlayed, userPlaylists,
    myPlaylists, myAlbums, myArtists, likedSongs,
    checkSaved, saveTracks, unsaveTracks,
    checkAlbumSaved, saveAlbum, unsaveAlbum,
    checkFollow, follow, unfollow,
    playlist, playlistTracks,
    createPlaylist, addToPlaylist, removeFromPlaylist, updatePlaylist,
    album, artist, artistTopTracks, artistAlbums, artistRelated,
    search, categories, featuredPlaylists, newReleases,
    recommendations, audioFeatures,
    playbackState, myDevices, myQueue, transferDevice,
    play, pause, nextTrack, prevTrack,
    seek, setVolume, setShuffle, setRepeat, addToQueue,
    clearToken, ms2t, imgUrl, esc,
  };
})();
