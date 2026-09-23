/**
 * Opaque client correlation identifiers.
 *
 * They identify a request, never a person, session, document or provider. The
 * API validates the conservative character set before it accepts the header.
 */
function randomPart(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    cryptoApi.getRandomValues(values);
    return `${values[0].toString(36)}${values[1].toString(36)}`;
  }

  // This identifier is a correlation hint, not an authentication credential.
  // The fallback keeps native runtimes without Web Crypto operational.
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function createClientRequestId(scope = 'req'): string {
  const safeScope = scope.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) || 'req';
  return `${safeScope}-${Date.now().toString(36)}-${randomPart()}`.slice(0, 120);
}
