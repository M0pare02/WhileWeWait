// Shared helpers for the room API routes: codes, tokens, request/response
// plumbing, and an atomic read-modify-write loop over the room blob.

const crypto = require('crypto');
const redis  = require('./redis');

// Avoid visually ambiguous characters (no O/0, I/1) so codes are easy to read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(len = 4) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

function genToken() {
  return crypto.randomUUID();
}

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return req.body;
}

function send(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

function methodGuard(req, res, method) {
  if (req.method !== method) {
    send(res, 405, { error: 'method_not_allowed' });
    return false;
  }
  return true;
}

// Read the room, apply a mutation, and CAS it back. `apply(room)` mutates the
// room in place and returns either `{ error, status }` to abort, or a payload
// object that is merged into the response. Retries on a concurrent version bump.
async function mutate(code, apply) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const room = await redis.getRoom(code);
    if (!room) return { error: { error: 'not_found', status: 404 } };

    const expected = room.version;
    const payload  = apply(room);
    if (payload && payload.error) {
      return { error: { error: payload.error, status: payload.status || 400 } };
    }

    room.version   = expected + 1;
    room.updatedAt = Math.floor(Date.now() / 1000);

    const cas = await redis.casRoom(code, expected, room);
    if (cas === 1)  return { room, payload: payload || {} };
    if (cas === -1) return { error: { error: 'not_found', status: 404 } };
    // cas === 0 → someone else moved first; loop and retry with fresh state.
  }
  return { error: { error: 'conflict', status: 409 } };
}

// Public projection of a room (never leak other players' tokens to the client).
function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    config: room.config,
    seatCount: room.seatCount,
    seats: room.seats.map(s => ({ name: s.name, color: s.color, filled: !!s.token })),
    state: room.state,
    lastMove: room.lastMove,
    version: room.version,
  };
}

module.exports = {
  genCode, genToken, getBody, send, methodGuard, mutate, publicRoom,
};
