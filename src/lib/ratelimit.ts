import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 1 pin per IP per day, per action type (spec Section 4) — rent pins,
// listings, and seeker pins are capped independently of each other.
export const rentPinCreateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '1 d'),
  prefix: 'ggnlife:rent-pin-create',
});

export const listingCreateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '1 d'),
  prefix: 'ggnlife:listing-create',
});

export const seekerPinCreateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '1 d'),
  prefix: 'ggnlife:seeker-pin-create',
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
