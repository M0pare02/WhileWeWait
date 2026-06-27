// POST /api/room/:code/close — host closes the room.
// Deletes the room from Redis so waiting players see a 404 on their next poll
// and are redirected home with "This room has closed."

const { send, getBody } = require('../../_lib/room');
const redis = require('../../_lib/redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const code = String(req.query.code || '').toUpperCase();
    const body = getBody(req);

    const room = await redis.getRoom(code);
    if (!room) return send(res, 404, { error: 'not_found' });
    if (!body.token || body.token !== room.hostToken) {
      return send(res, 403, { error: 'forbidden' });
    }

    await redis.deleteRoom(code);
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 500, { error: 'server_error' });
  }
};
