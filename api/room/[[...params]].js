// Router for all Grid Grab room endpoints (Vercel optional catch-all).
//
//   POST /api/room                — create room
//   GET  /api/room/:code          — poll for updates
//   POST /api/room/:code          — host closes the room
//   POST /api/room/:code/join     — player joins
//   POST /api/room/:code/move     — player makes a move
//   POST /api/room/:code/start    — host starts the game

const { genToken, genCode, getBody, send, mutate, publicRoom } = require('../_lib/room');
const redis    = require('../_lib/redis');
const GGEngine = require('../../grid-grab/js/engine.js');

const PALETTE = ['#FF6B6B', '#45B7D1', '#FFC947', '#A855F7', '#FF6B9D', '#98D856'];

module.exports = async (req, res) => {
  const segs = [].concat(req.query.params || []);
  const [seg0, sub] = segs;
  const code = seg0 ? seg0.toUpperCase() : null;

  // ── POST /api/room — create ──────────────────────────────────────────────
  if (!code) {
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
    try {
      const body      = getBody(req);
      const cols      = body.config && Number(body.config.cols);
      const rows      = body.config && Number(body.config.rows);
      const seatCount = Number(body.seatCount);
      const host      = body.host || {};

      if (!cols || !rows || !(seatCount >= 2 && seatCount <= 4) || !host.name || !host.color) {
        return send(res, 400, { error: 'invalid_config' });
      }

      const hostToken = genToken();
      const seats = [];
      for (let i = 0; i < seatCount; i++) {
        seats.push(i === 0
          ? { name: String(host.name).slice(0, 16) || 'Player 1', color: host.color, token: hostToken }
          : { name: `Player ${i + 1}`, color: PALETTE[i % PALETTE.length], token: null });
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        const roomCode = genCode();
        const room = {
          code: roomCode, status: 'lobby',
          config: { cols, rows }, seatCount,
          hostToken, seats,
          state: null, lastMove: null,
          version: 0, updatedAt: Math.floor(Date.now() / 1000),
        };
        if (await redis.createRoom(roomCode, room)) {
          return send(res, 200, { code: roomCode, token: hostToken, seat: 0, room: publicRoom(room) });
        }
      }
      return send(res, 503, { error: 'code_exhausted' });
    } catch (e) {
      return send(res, 500, { error: 'server_error', detail: String(e.message || e) });
    }
  }

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
