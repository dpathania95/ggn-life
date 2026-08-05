import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Local-dev escape hatch — every call site only reads `{ success }`, so a
// no-op stand-in with the same shape lets us skip real Redis calls entirely
// without touching any route. Never set this in production.
const RATE_LIMIT_DISABLED = process.env.DISABLE_RATE_LIMIT === 'true';

interface LimiterLike {
  limit: (identifier: string) => Promise<{ success: boolean }>;
}

const noopLimiter: LimiterLike = {
  limit: async () => ({ success: true }),
};

function makeLimiter(config: { limiter: ReturnType<typeof Ratelimit.slidingWindow>; prefix: string }): LimiterLike {
  return RATE_LIMIT_DISABLED ? noopLimiter : new Ratelimit({ redis, ...config });
}

// 1 pin per IP per day, per action type (spec Section 4) — rent pins,
// listings, and seeker pins are capped independently of each other.
export const rentPinCreateLimiter = makeLimiter({
  limiter: Ratelimit.slidingWindow(1, '1 d'),
  prefix: 'ggnlife:rent-pin-create',
});

export const listingCreateLimiter = makeLimiter({
  limiter: Ratelimit.slidingWindow(1, '1 d'),
  prefix: 'ggnlife:listing-create',
});

export const seekerPinCreateLimiter = makeLimiter({
  limiter: Ratelimit.slidingWindow(1, '1 d'),
  prefix: 'ggnlife:seeker-pin-create',
});

// Lighter cap for reports — a cheap action, but still worth capping (spec
// Section 4's community-reporting anti-fraud layer).
export const reportLimiter = makeLimiter({
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'ggnlife:report',
});

// Looser than the 1/day pin-creation caps — expressing interest is
// lower-stakes, but still needs a ceiling against spam (spec Section
// 3.10/4). Shared across both listing and seeker-pin interest requests.
export const interestRequestLimiter = makeLimiter({
  limiter: Ratelimit.slidingWindow(5, '1 d'),
  prefix: 'ggnlife:interest-request',
});

// Nominatim's usage policy caps requests at 1/second GLOBALLY, across all
// callers of the shared free public API — not per-IP like the limiters
// above (spec Section 3.8). Always call .limit('global') with this one.
export const nominatimThrottle = makeLimiter({
  limiter: Ratelimit.slidingWindow(1, '1 s'),
  prefix: 'ggnlife:nominatim',
});

// Never store raw IPs. Hash with a server-only salt before persisting
// (e.g. in pins.ip_hash) so abuse patterns are detectable without keeping PII.
export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + process.env.IP_HASH_SALT)
    .digest('hex');
}

// Best-effort client IP extraction behind Vercel's proxy.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? '0.0.0.0';
}
