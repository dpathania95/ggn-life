import { randomBytes, createHash } from 'crypto';

// Magic-link management token (spec Section 3.6). Only the hash is ever
// persisted (manage_token_hash) — the raw token is the sole authentication
// for the "mark as rented/matched" / delete link and must never be stored.
// Until email integration exists, the raw token is returned directly in the
// creation response as a stand-in delivery mechanism.
export function generateManageToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}
