/**
 * In-memory per-IP rate limiter for Edge Functions.
 *
 * Why in-memory and not Redis/database?
 * --------------------------------------
 * Edge Function instances are ephemeral but warm for several minutes between
 * recycles. For a small institutional CMS (~10 municipal users), in-memory
 * per-instance counts are "good enough" — they cap a runaway client or a
 * misconfigured loop, which is the realistic threat. They do NOT defend
 * against a distributed DoS, but that requires Cloudflare-level rate limiting
 * which is a separate concern handled outside the application code.
 *
 * Why a fixed window and not a token bucket?
 * ------------------------------------------
 * A token bucket needs floating-point math and per-request decay calculations.
 * A fixed window is simpler, deterministic, and more than enough for the
 * threat model. The slight burst-at-window-edge weakness is irrelevant when
 * the limit is 120/min.
 *
 * Memory safety
 * -------------
 * The Map is capped at MAX_BUCKETS entries. When the cap is reached we sweep
 * stale entries (>1 window old). In the unlikely case that the cap is hit
 * with all-fresh entries we accept slightly degraded enforcement rather than
 * unbounded memory growth.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // ~2 req/sec sustained
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Throws `{status: 429, message}` if the client has exceeded the limit.
 * Otherwise returns silently and increments the counter.
 *
 * Call this at the very top of the request handler (before auth) so a
 * flooding client cannot exhaust DB connections via auth lookups.
 */
export function rateLimit(req: Request): void {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip);

  // New window (or first request from this IP)
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    // Opportunistic cleanup of stale buckets to keep memory bounded.
    if (buckets.size >= MAX_BUCKETS) {
      let removed = 0;
      for (const [key, val] of buckets) {
        if (now - val.windowStart > WINDOW_MS) {
          buckets.delete(key);
          if (++removed > 1000) break; // bounded cleanup per request
        }
      }
    }
    buckets.set(ip, { count: 1, windowStart: now });
    return;
  }

  // Existing window — increment and check
  bucket.count++;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    const retrySeconds = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    throw {
      status: 429,
      message: `Demasiadas peticiones. Espera ${retrySeconds} segundos antes de reintentar.`,
    };
  }
}

/** Best-effort client IP extraction. */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;
  return 'unknown';
}
