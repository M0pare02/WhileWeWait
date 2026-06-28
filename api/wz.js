// All WordZ room API routes in one file.
// vercel.json rewrites /api/wz/:code[/:sub] here, injecting code/sub as query params.
//
//   POST /api/wz                   — create room
//   GET  /api/wz/:code             — poll for updates
//   POST /api/wz/:code             — host closes the room
//   POST /api/wz/:code/join        — player joins
//   POST /api/wz/:code/submit      — player submits a pick or word
//   POST /api/wz/:code/state       — host pushes authoritative game state

const { genToken, genCode, getBody, send, mutate } = require('./_lib/room');
const { publicRoom } = require('./_lib/wz');
const redis = require('./_lib/redis');

const MAX_SUBMISSIONS = 200;

module.exports = async (req, res) => {
  const code = req.query.code ? req.query.code.toUpperCase() : null;
  const sub  = req.query.sub  || null;

  // ── POST /api/wz — create ────────────────────────────────────────────────
  if (!code) {
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
    try {
      const body    = getBody(req);
      const variant = body.config && body.config.variant;
      const rounds  = body.config && Number(body.config.rounds);
      const host    = body.host || {};

      if ((variant !== '1v1' && variant !== 'multi') ||
          !Number.isInteger(rounds) || rounds < 0 || rounds > 50 ||
          !host.name || !host.color) {
        return send(res, 400, { error: 'invalid_config' });
      }

      const maxSeats  = variant === '1v1' ? 2 : 8;
      const hostToken = genToken();
      const seats = [{ name: String(host.name).slice(0, 16) || 'Player 1', color: String(host.color), token: hostToken }];

      for (let attempt = 0; attempt < 5; attempt++) {
        const roomCode = genCode();
        const room = {
          code: roomCode, status: 'lobby', game: 'wordz',
          config: { variant, rounds }, maxSeats,
          hostToken, seats,
          state: null, submissions: [],
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

  // ── /api/wz/:code — poll or close ────────────────────────────────────────
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

  // ── /api/wz/:code/:sub — join | submit | state ───────────────────────────
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const body = getBody(req);

  if (sub === 'join') {
    try {
      const name  = (body.name || '').toString().trim().slice(0, 16) || 'Player';
      const color = (body.color || '').toString();
      if (!color) return send(res, 400, { error: 'invalid' });

      const token = genToken();
      const out = await mutate(code, (room) => {
        if (room.status !== 'lobby')            return { error: 'already_started', status: 409 };
        if (room.seats.length >= room.maxSeats) return { error: 'full', status: 409 };
        const seat = room.seats.length;
        room.seats.push({ name, color, token });
        return { seat };
      });

      if (out.error) return send(res, out.error.status, { error: out.error.error });
      return send(res, 200, { token, seat: out.payload.seat, room: publicRoom(out.room) });
    } catch (e) {
      return send(res, 500, { error: 'server_error' });
    }
  }

  if (sub === 'submit') {
    try {
      const token = (body.token || '').toString();
      const kind  = body.kind === 'pick' ? 'pick' : 'word';
      const value = (body.value == null ? '' : String(body.value)).slice(0, 40);

      const out = await mutate(code, (room) => {
        if (room.status !== 'playing') return { error: 'not_playing', status: 409 };
        const seat = room.seats.findIndex(s => s.token === token);
        if (seat === -1) return { error: 'not_in_room', status: 403 };
        if (!Array.isArray(room.submissions)) room.submissions = [];
        room.submissions.push({ seat, kind, value, ts: Date.now() });
        if (room.submissions.length > MAX_SUBMISSIONS) {
          room.submissions = room.submissions.slice(-MAX_SUBMISSIONS);
        }
        return { seat };
      });

      if (out.error) return send(res, out.error.status, { error: out.error.error });
      return send(res, 200, { ok: true, seat: out.payload.seat, version: out.room.version });
    } catch (e) {
      return send(res, 500, { error: 'server_error' });
    }
  }

  if (sub === 'state') {
    try {
      const token = (body.token || '').toString();

      const out = await mutate(code, (room) => {
        if (token !== room.hostToken) return { error: 'not_host', status: 403 };
        if (body.state !== undefined) room.state = body.state;
        if (typeof body.status === 'string') {
          if (['lobby', 'playing', 'over'].indexOf(body.status) === -1) {
            return { error: 'invalid_status', status: 400 };
          }
          room.status = body.status;
        }
        if (body.clearSubmissions) room.submissions = [];
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
