// POST /api/room/:code/move — authoritative move, replayed through the shared engine.
// Body: { token, kind:'h'|'v', row, col }
//
// The room blob is the single source of truth: we deserialize the stored state,
// validate the mover owns the current seat, apply the move via GGEngine, and CAS
// the new state back. A concurrent move bumps the version and triggers a retry
// (handled in `mutate`); an out-of-turn or illegal move returns 409 so the client
// re-syncs from a fresh GET.

const { getBody, send, methodGuard, mutate, publicRoom } = require('../../_lib/room');
const GGEngine = require('../../../grid-grab/js/engine.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, 'POST')) return;
  try {
    const code  = String(req.query.code || '').toUpperCase();
    const body  = getBody(req);
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
};
