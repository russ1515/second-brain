export type ObjectUrlRevoker = (url: string) => void;

function isObjectUrl(value: string): boolean {
  return value.startsWith('blob:');
}

function revokeWithBrowser(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

/**
 * Tracks browser object URLs owned by a screen.
 *
 * `replace` is intentionally called from a committed React effect: URLs that
 * disappeared from state are released only after the new preview rendered.
 * `releaseAll` covers route changes/unmounts. Duplicate URLs are revoked once.
 */
export function createObjectUrlLease(
  revoke: ObjectUrlRevoker = revokeWithBrowser,
): {
  replace(values: Iterable<string | null | undefined>): void;
  releaseAll(): void;
} {
  let active = new Set<string>();

  return {
    replace(values) {
      const next = new Set(
        [...values].filter((value): value is string => Boolean(value && isObjectUrl(value))),
      );
      for (const url of active) {
        if (!next.has(url)) revoke(url);
      }
      active = next;
    },
    releaseAll() {
      for (const url of active) revoke(url);
      active.clear();
    },
  };
}
