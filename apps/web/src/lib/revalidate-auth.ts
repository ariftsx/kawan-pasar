import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (v: string): Buffer => createHash('sha256').update(v).digest();

/** Constant-time token check (hashing first equalises lengths). */
export function tokenMatches(presented: string | null, expected: string): boolean {
  if (presented === null || presented.length === 0) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}
