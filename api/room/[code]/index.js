// GET /api/room/:code?v=<version> — poll endpoint.
// Returns the room only when its version is newer than `v`, else { changed:false }.

const { send, publicRoom } = require('../../_lib/room');
const redis = require('../../_lib/redis');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const code  = String(req.query.code || '').toUpperCase();
    const since = req.query.v != null ? Number(req.query.v) : -1;

    const room = await redis.getRoom(code);
    if (!room) return send(res, 404, { error: 'not_found' });

    if (Number.isFinite(since) && since >= 0 && room.version <= since) {
      return send(res, 200, { changed: false, version: room.version });
    }
    return send(res, 200, { changed: true, room: publicRoom(room) });
  } catch (e) {
    return send(res, 500, { error: 'server_error' });
  }
};
