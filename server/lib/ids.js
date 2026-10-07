// ULID (Crockford base32, 26 chars): ordenable por tiempo, sin dependencias.
import { randomBytes } from 'node:crypto';
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function ulid(now = Date.now()) {
  let t = '', ms = now;
  for (let i = 0; i < 10; i++) { t = B32[ms % 32] + t; ms = Math.floor(ms / 32); }
  const rnd = randomBytes(16); let r = '';
  for (let i = 0; i < 16; i++) r += B32[rnd[i] % 32];
  return t + r;
}
export const nowIso = () => new Date().toISOString();
