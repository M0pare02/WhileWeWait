// Thin wrapper over the Upstash Redis REST API (no SDK / no dependencies).
// Env vars are injected by the Upstash integration in the Vercel dashboard.

// Vercel KV (powered by Upstash) uses KV_REST_API_* names;
// direct Upstash integration uses UPSTASH_REDIS_REST_* names. Support both.
const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const TTL = 6 * 60 * 60; // rooms self-expire after 6 hours

async function command(args) {
  if (!URL || !TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars');
  }
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`Redis error: ${data.error || res.status}`);
  }
  return data.result;
}

async function getRoom(code) {
  const v = await command(['GET', 'room:' + code]);
  if (v == null) return null;
  return typeof v === 'string' ? JSON.parse(v) : v;
}

// Create only if the code is unused (atomic via SET NX). Returns true on success.
async function createRoom(code, room) {
  const r = await command(['SET', 'room:' + code, JSON.stringify(room), 'EX', String(TTL), 'NX']);
  return r === 'OK';
}

// Compare-and-set: write `room` only if the stored version still equals
// `expectedVersion`. Returns 1 (written), 0 (version moved on — retry), -1 (gone).
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if not cur then return -1 end
local ok, obj = pcall(cjson.decode, cur)
if not ok then return -2 end
if tonumber(obj.version) ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

async function casRoom(code, expectedVersion, room) {
  const r = await command([
    'EVAL', CAS_SCRIPT, '1', 'room:' + code,
    String(expectedVersion), JSON.stringify(room), String(TTL),
  ]);
  return Number(r);
}

module.exports = { command, getRoom, createRoom, casRoom, TTL };
