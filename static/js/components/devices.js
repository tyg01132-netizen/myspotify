/* components/devices.js */
const DevicesComp = (() => {
  let _open = false;

  function init() {
    document.getElementById('nav-devices')?.addEventListener('click', e => { e.preventDefault(); toggle(); });
    document.getElementById('dev-close')?.addEventListener('click', close);
  }

  function toggle() { _open ? close() : open(); }

  function open() {
    _open = true;
    document.getElementById('dev-panel').classList.add('open');
    document.getElementById('nav-devices').classList.add('active');
    load();
  }

  function close() {
    _open = false;
    document.getElementById('dev-panel').classList.remove('open');
    document.getElementById('nav-devices').classList.remove('active');
  }

  async function load() {
    const body = document.getElementById('dev-body');
    body.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:16px 0;color:var(--i3)"><div class="ld"><span></span><span></span><span></span></div></div>`;

    const data = await API.myDevices();
    const devs = data?.devices || [];

    if (!devs.length) {
      body.innerHTML = `<div class="empty-msg" style="padding:16px 12px"><p>No active devices found.</p><p style="margin-top:6px;font-size:12px;color:var(--i3)">Open Spotify on a device to see it here.</p></div>`;
      return;
    }

    body.innerHTML = devs.map(d => `
      <div class="dev-item${d.is_active?' cur':''}" data-id="${d.id}">
        <div class="dev-dot"></div>
        <div><div class="dev-name">${API.esc(d.name)}</div><div class="dev-type">${API.esc(d.type)}${d.is_active?' · Active':''}</div></div>
      </div>`).join('');

    body.querySelectorAll('.dev-item').forEach((el, i) => {
      el.addEventListener('click', async () => {
        await API.transferDevice(devs[i].id, true);
        App.toast(`Switched to ${devs[i].name}`, 'ok');
        close();
      });
    });
  }

  return { init, toggle, open, close };
})();
