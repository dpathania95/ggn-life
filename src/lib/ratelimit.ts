import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Max 10 pins per IP per day. Adjust once you see real usage patterns —
// this is a placeholder threshold, not a tuned number (see spec, open questions).
export const pinCreateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 d'),
  prefix: 'ggnlife:pin-create',
});

// Lighter limit for votes/reports — cheap actions, but still worth capping.
export const voteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: 'ggnlife:vote',
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
