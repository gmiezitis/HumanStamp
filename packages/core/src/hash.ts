import crypto from 'crypto';

/**
 * SHA-256 hard bind: hash file bytes
 */
export function hashFile(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * SHA-256 hash from stream
 */
export function createHashStream(): crypto.Hash {
  return crypto.createHash('sha256');
}

/**
 * Truncate hash for display (first 8 chars + ellipsis)
 */
export function truncateHash(hash: string, length: number = 8): string {
  return `${hash.slice(0, length)}...`;
}
