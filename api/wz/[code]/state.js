// POST /api/wz/:code/state — host-only authoritative state write.
// Body: { token, state?, status?, clearSubmissions? }
//
// The host runs WZEngine in its browser and pushes the resulting state here. The
// server just stores it (after verifying the host token) and bumps the version so
// other players pick it up on their next poll.

const { getBody, send, methodGuard, mutate } = require('../../_lib/room');
const { publicRoom } = require('../../_lib/wz');

module.exports = async (req, res) => {
  if (!methodGuard(req, res, 'POST')) return;
  try {
    const code = String(req.query.code || '').toUpperCase();
    const body = getBody(req);
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
};
