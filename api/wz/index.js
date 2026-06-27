// POST /api/wz — create a WordZ room.
// Vercel routes the bare /api/wz path here (index.js wins over [[...params]].js
// for the base directory path).

const { genToken, genCode, getBody, send } = require('../_lib/room');
const { publicRoom } = require('../_lib/wz');
const redis = require('../_lib/redis');

module.exports = async (req, res) => {
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
};
