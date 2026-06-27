// Router for Grid Grab room endpoints (Vercel optional catch-all).
// Create-room (POST /api/room) is handled by index.js; this file handles
// all routes that include a room code.
//
//   GET  /api/room/:code          — poll for updates
//   POST /api/room/:code          — host closes the room
//   POST /api/room/:code/join     — player joins
//   POST /api/room/:code/move     — player makes a move
//   POST /api/room/:code/start    — host starts the game

const { getBody, send, mutate, publicRoom } = require('../_lib/room');
const redis    = require('../_lib/redis');
const GGEngine = require('../../grid-grab/js/engine.js');

module.exports = async (req, res) => {
  const segs = [].concat(req.query.params || []);
  const [seg0, sub] = segs;
  const code = seg0 ? seg0.toUpperCase() : null;

  if (!code) return send(res, 404, { error: 'not_found' });

  // ── /api/room/:code — poll or close ──────────────────────────────────────
  if (!sub) {
    if (req.method === 'POST') {
      try {
        const body = getBody(req);
        const room = await redis.getRoom(code);
        if (!room) return send(res, 404, { error: 'not_found' });
        if (!body.token || body.token !== room.hostToken) return send(res, 403, { error: 'forbidden' });
        await redis.deleteRoom(code);
        return send(res, 200, { ok: true });
      } catch (e) {
        return send(res, 500, { error: 'server_error' });
      }
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
    try {
      const since = req.query.v != null ? Number(req.query.v) : -1;
      const room  = await redis.getRoom(code);
      if (!room) return send(res, 404, { error: 'not_found' });
      if (Number.isFinite(since) && since >= 0 && room.version <= since) {
        return send(res, 200, { changed: false, version: room.version });
      }
      return send(res, 200, { changed: true, room: publicRoom(room) });
    } catch (e) {
      return send(res, 500, { error: 'server_error' });
    }
  }

  // ── /api/room/:code/:sub — join | move | start ───────────────────────────
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const body = getBody(req);

  if (sub === 'join') {
    try {
      const name  = (body.name || '').toString().trim().slice(0, 16) || 'Player';
      const color = (body.color || '').toString();
      if (!color) return send(res, 400, { error: 'invalid' });

      const token = genToken();
      const out = await mutate(code, (room) => {
        if (room.status !== 'lobby') return { error: 'already_started', status: 409 };
        const idx = room.seats.findIndex(s => !s.token);
        if (idx === -1) return { error: 'full', status: 409 };
        room.seats[idx] = { name, color, token };
        return { seat: idx };
      });

      if (out.error) return send(res, out.error.status, { error: out.error.error });
      return send(res, 200, { token, seat: out.payload.seat, room: publicRoom(out.room) });
    } catch (e) {
      return send(res, 500, { error: 'server_error' });
    }
  }

  if (sub === 'move') {
    try {
      const token = (body.token || '').toString();
      const kind  = body.kind;
      const row   = Number(body.row);
      const col   = Number(body.col);

      if ((kind !== 'h' && kind !== 'v') || !Number.isInteger(row) || !Number.isInteger(col)) {
        return send(res, 400, { error: 'invalid_move' });
      }

      const out = await mutate(code, (room) => {
        if (room.status !== 'playing') return { error: 'not_playing', status: 409 };
        const seat = room.seats.findIndex(s => s.token === token);
        if (seat === -1) return { error: 'not_in_room', status: 403 };
        const state = GGEngine.deserialize(room.state);
        if (GGEngine.expectedSeat(state) !== seat) return { error: 'not_your_turn', status: 409 };
        const result = GGEngine.tryClaimLine(state, kind, row, col);
        if (!result) return { error: 'illegal_move', status: 409 };
        room.state    = GGEngine.serialize(state);
        room.lastMove = { seat, kind, row, col };
        if (result.gameOver) room.status = 'finished';
        return { ok: true };
      });

      if (out.error) return send(res, out.error.status, { error: out.error.error });
      return send(res, 200, { room: publicRoom(out.room) });
    } catch (e) {
      return send(res, 500, { error: 'server_error' });
    }
  }

  if (sub === 'start') {
    try {
      const token = (body.token || '').toString();

      const out = await mutate(code, (room) => {
        if (token !== room.hostToken)        return { error: 'not_host', status: 403 };
        if (room.status === 'playing')       return { error: 'in_progress', status: 409 };
        if (room.seats.some(s => !s.token)) return { error: 'seats_not_filled', status: 409 };

        const players = room.seats.map(s => ({ name: s.name, color: s.color }));
        const state   = GGEngine.initState({ cols: room.config.cols, rows: room.config.rows, players });
        room.state    = GGEngine.serialize(state);
        room.status   = 'playing';
        room.lastMove = null;
        return { ok: true };
      });

      if (out.error) return send(res, out.error.status, { error: out.error.error });
      return send(res, 200, { room: publicRoom(out.room) });
    } catch (e) {
      return send(res, 500, { error: 'server_error' });
    }
  }

  return send(res, 404, { error: 'not_found' });
};
