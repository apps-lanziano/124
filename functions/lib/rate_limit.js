const MAX_CALLS = 20;
const WINDOW_MS = 60 * 1000;

const buckets = new Map();

function checkRateLimit(uid) {
  const now = Date.now();
  let bucket = buckets.get(uid);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(uid, bucket);
  }
  bucket.count++;
  if (bucket.count > MAX_CALLS) return false;
  return true;
}

if (buckets.size > 10000) {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [k, v] of buckets) {
    if (v.windowStart < cutoff) buckets.delete(k);
  }
}

module.exports = { checkRateLimit, MAX_CALLS, WINDOW_MS };
