// POST /api/room — create a Grid Grab room.
// Vercel routes the bare /api/room path here (index.js wins over [[...params]].js
// for the base directory path).

const { genToken, genCode, getBody, send, publicRoom } = require('../_lib/room');
const redis = require('../_lib/redis');

const PALETTE = ['#FF6B6B', '#45B7D1', '#FFC947', '#A855F7', '#FF6B9D', '#98D856'];

module.exports = async (req, res) => {
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
};
