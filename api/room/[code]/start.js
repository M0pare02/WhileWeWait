// POST /api/room/:code/start — host begins the game once every seat is filled.
// Body: { token }

const { getBody, send, methodGuard, mutate, publicRoom } = require('../../_lib/room');
const GGEngine = require('../../../grid-grab/js/engine.js');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, 'POST')) return;
  try {
    const code  = String(req.query.code || '').toUpperCase();
    const token = (getBody(req).token || '').toString();

    const out = await mutate(code, (room) => {
      if (token !== room.hostToken)            return { error: 'not_host', status: 403 };
      if (room.status === 'playing')           return { error: 'in_progress', status: 409 };
      if (room.seats.some(s => !s.token))      return { error: 'seats_not_filled', status: 409 };

      const players = room.seats.map(s => ({ name: s.name, color: s.color }));
      const state = GGEngine.initState({ cols: room.config.cols, rows: room.config.rows, players });
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
};
