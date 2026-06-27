// POST /api/wz/:code/submit — a player submits a pick or a word for the round.
// Body: { token, kind:'pick'|'word', value }
//
// The server records the submission (with its arrival timestamp) but performs no
// game logic — the host reads the ordered submissions and resolves the round.
// CAS ordering inside `mutate` makes the append order the fair race order.

const { getBody, send, methodGuard, mutate } = require('../../_lib/room');

const MAX_SUBMISSIONS = 200; // safety cap so the blob can't grow unbounded

module.exports = async (req, res) => {
  if (!methodGuard(req, res, 'POST')) return;
  try {
    const code  = String(req.query.code || '').toUpperCase();
    const body  = getBody(req);
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
};
