// Grid Grab networking client — shared by setup, lobby, and game screens.
// Exposes a `GGNet` global (same IIFE pattern as GGEngine). Stores this device's
// room identity ({ code, token, seat, host }) in sessionStorage under `gg_net`.

const GGNet = (() => {

  const KEY = 'gg_net';

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

  const createRoom = (config, seatCount, host) =>
    api('/room', { method: 'POST', body: { config, seatCount, host } });

  const joinRoom = (code, name, color) =>
    api(`/room/${code}/join`, { method: 'POST', body: { name, color } });

  const startGame = (code, token) =>
    api(`/room/${code}/start`, { method: 'POST', body: { token } });

  const sendMove = (code, token, kind, row, col) =>
    api(`/room/${code}/move`, { method: 'POST', body: { token, kind, row, col } });

  const pollRoom = (code, version) =>
    api(`/room/${code}` + (version != null ? `?v=${version}` : ''));

  const closeRoom = (code, token) =>
    api(`/room/${code}`, { method: 'POST', body: { token } });

  function beaconCloseRoom(code, token) {
    navigator.sendBeacon(
      '/api/room/' + code,
      new Blob([JSON.stringify({ token })], { type: 'application/json' })
    );
  }

  return { get, set, clear, createRoom, joinRoom, startGame, sendMove, pollRoom, closeRoom, beaconCloseRoom };
})();
