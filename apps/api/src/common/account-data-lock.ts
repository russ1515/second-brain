/**
 * Cross-replica lock namespace for operations that can create data owned by an
 * account outside PostgreSQL (for example Qdrant vectors). Account erasure and
 * those writers must use the exact same key.
 */
export function accountDataLockKey(userId: string): string {
  return `account-data:${userId}`;
}
