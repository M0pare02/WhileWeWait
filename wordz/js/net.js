// WordZ networking client — shared by setup, lobby, and game screens.
// Exposes a `WZNet` global (same IIFE pattern as GGNet). Stores this device's
// room identity ({ code, token, seat, host }) in sessionStorage under `wz_net`.

const WZNet = (() => {

  const KEY = 'wz_net';

  function get() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
  }
  function set(net) { try { sessionStorage.setItem(KEY, JSON.stringify(net)); } catch (_) {} }
  function clear()  { try { sessionStorage.removeItem(KEY); } catch (_) {} }

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch('/api' + path, {
      method:  opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body:    opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || ('http_' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const createRoom = (config, host) =>
    api('/wz', { method: 'POST', body: { config, host } });

  const joinRoom = (code, name, color) =>
    api(`/wz/${code}/join`, { method: 'POST', body: { name, color } });

  // Flip the room to "playing" so everyone advances from the lobby to the game.
  const startGame = (code, token) =>
    api(`/wz/${code}/state`, { method: 'POST', body: { token, status: 'playing' } });

  // Host-only authoritative state push. opts: { state, status, clearSubmissions }.
  const writeState = (code, token, opts) =>
    api(`/wz/${code}/state`, { method: 'POST', body: Object.assign({ token }, opts) });

  const submit = (code, token, kind, value) =>
    api(`/wz/${code}/submit`, { method: 'POST', body: { token, kind, value } });

  const pollRoom = (code, version) =>
    api(`/wz/${code}` + (version != null ? `?v=${version}` : ''));

  const closeRoom = (code, token) =>
    api(`/wz/${code}`, { method: 'POST', body: { token } });

  function beaconCloseRoom(code, token) {
    navigator.sendBeacon(
      '/api/wz/' + code,
      new Blob([JSON.stringify({ token })], { type: 'application/json' })
    );
  }

  return { get, set, clear, createRoom, joinRoom, startGame, writeState, submit, pollRoom, closeRoom, beaconCloseRoom };
})();
