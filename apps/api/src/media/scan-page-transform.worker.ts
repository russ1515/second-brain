import { parentPort, workerData } from 'node:worker_threads';
import {
  warpPerspectiveRaw,
  type RawPerspectiveInput,
  type ScanQuadrilateral,
} from './scan-page-transform';

interface ScanPerspectiveWorkerData {
  input: RawPerspectiveInput;
  quad: ScanQuadrilateral;
}

try {
  const data = workerData as ScanPerspectiveWorkerData;
  const output = warpPerspectiveRaw({
    ...data.input,
    data: Buffer.from(data.input.data),
  }, data.quad);
  parentPort?.postMessage({ ok: true, output });
  parentPort?.close();
} catch {
  // Do not serialize implementation details or source data back into the API
  // error path. The parent maps this to one stable, non-sensitive response.
  parentPort?.postMessage({ ok: false });
  parentPort?.close();
}
