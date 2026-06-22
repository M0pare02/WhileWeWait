// POST /api/room/:code/join — claim the next open seat.
// Body: { name, color }  →  { token, seat, room }

const { getBody, send, methodGuard, genToken, mutate, publicRoom } = require('../../_lib/room');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, 'POST')) return;
  try {
    const code  = String(req.query.code || '').toUpperCase();
    const body  = getBody(req);
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
};
