/**
 * Cursor pagination (Sprint 10.1 — Performance).
 *
 * A reusable envelope for large lists so the client can fetch a page at a time
 * instead of the whole collection. Cursor-based (not offset) so it stays correct
 * and O(1) as the collection grows. `nextCursor` is null on the last page.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
