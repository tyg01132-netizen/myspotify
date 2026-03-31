/* components/queue.js */
const QueueComp = (() => {
  let _open = false;

  function init() {
    document.getElementById('nav-queue')?.addEventListener('click', e => { e.preventDefault(); toggle(); });
    document.getElementById('queue-close')?.addEventListener('click', close);
  }

  function toggle() { _open ? close() : open(); }

  function open() {
    _open = true;
    document.getElementById('queue-panel').classList.add('open');
    document.getElementById('nav-queue').classList.add('active');
    load();
  }

  function close() {
    _open = false;
    document.getElementById('queue-panel').classList.remove('open');
    document.getElementById('nav-queue').classList.remove('active');
  }

  async function load() {
    const body = document.getElementById('queue-body');
    body.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:16px 0;color:var(--i3)"><div class="ld"><span></span><span></span><span></span></div></div>`;

    const data = await API.myQueue();
    if (!data) { body.innerHTML = '<div class="empty-msg" style="padding:16px 8px">Could not load queue.</div>'; return; }

    const e = API.esc;
    let html = '';

    if (data.currently_playing) {
      const t = data.currently_playing;
      const img = API.imgUrl(t.album?.images, 48);
      html += `<span class="p-lbl">Now Playing</span>
        <div class="q-item" style="background:rgba(var(--accent-r),var(--accent-g),var(--accent-b),.07)">
          ${img ? `<img class="q-art" src="${img}" alt=""/>` : '<div class="q-art"></div>'}
          <div class="q-info"><div class="q-name" style="color:var(--acc)">${e(t.name)}</div><div class="q-sub">${e(t.artists?.map(a=>a.name).join(', '))}</div></div>
        </div>`;
    }

    const next = (data.queue||[]).slice(0, 25);
    if (next.length) {
      html += `<span class="p-lbl" style="margin-top:14px;display:block">Next Up</span>`;
      html += next.map(t => {
        const img = API.imgUrl(t.album?.images, 48);
        return `<div class="q-item">
          ${img ? `<img class="q-art" src="${img}" alt=""/>` : '<div class="q-art"></div>'}
          <div class="q-info"><div class="q-name">${e(t.name)}</div><div class="q-sub">${e(t.artists?.map(a=>a.name).join(', '))}</div></div>
        </div>`;
      }).join('');
    }

    body.innerHTML = html || '<div class="empty-msg" style="padding:16px 8px">Queue is empty.</div>';
  }

  function onState() { if (_open) load(); }

  return { init, toggle, open, close, load, onState };
})();
