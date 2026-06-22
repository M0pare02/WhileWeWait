// Temporary debug endpoint — DELETE before deploying to production.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    hasUrl:   !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    hasToken: !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
    urlPrefix: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').slice(0, 40),
    kvUrl: !!process.env.KV_REST_API_URL,
    kvToken: !!process.env.KV_REST_API_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  }));
};
