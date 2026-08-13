/**
 * Qdrant client ↔ Node fetch compatibility shim.
 *
 * `@qdrant/js-client-rest` (v1.18, latest) injects a per-request `dispatcher`
 * built from its bundled `undici@6` Agent into every `fetch` call. Node >= 24
 * ships `undici@7`/`@8` as the global `fetch` implementation, and its dispatcher
 * validation rejects the v6 handler shape with:
 *   `TypeError: fetch failed` / cause `UND_ERR_INVALID_ARG: invalid onError method`.
 *
 * Result: any Qdrant call (including the /api/health check) fails even though the
 * server is reachable. We fix it by pointing the global `fetch` at the same
 * `undici@6` the Qdrant client uses, so the v6 Agent matches the v6 fetch — this
 * is exactly the fetch Node 22 LTS ships, so it is well-tested and low risk.
 *
 * The shim is a no-op when Node's built-in undici is already v6.x (e.g. on an LTS
 * runtime), so it self-disables once the runtime — or the Qdrant client — catches up.
 *
 * Must be imported before any module that constructs a QdrantClient.
 */
import { fetch, Headers, Request, Response, FormData } from 'undici';

const nativeUndici = process.versions.undici; // e.g. "8.7.0"; undefined on non-Node runtimes
const nativeMajor = nativeUndici ? Number(nativeUndici.split('.')[0]) : 0;

if (nativeMajor >= 7) {
  Object.assign(globalThis, { fetch, Headers, Request, Response, FormData });
}
