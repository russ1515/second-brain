const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const apiProxyTarget = process.env.ADMIN_API_PROXY_TARGET;
const hopByHopHeaders = new Set(['connection', 'content-encoding', 'content-length', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

async function proxyApi(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && name.toLowerCase() !== 'host') headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  try {
    const upstream = await fetch(new URL(request.url ?? '/', apiProxyTarget), {
      method: request.method,
      headers,
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    });
    response.statusCode = upstream.status;
    for (const [name, value] of upstream.headers) {
      if (!hopByHopHeaders.has(name.toLowerCase())) response.setHeader(name, value);
    }
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.statusCode = 502;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ message: 'Local Admin API proxy unavailable.' }));
  }
}

http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (apiProxyTarget && (pathname === '/api' || pathname.startsWith('/api/'))) {
    await proxyApi(request, response);
    return;
  }
  const candidate = path.resolve(root, `.${pathname}`);
  const safeCandidate = candidate.startsWith(root) ? candidate : path.join(root, 'index.html');
  const file = fs.existsSync(safeCandidate) && fs.statSync(safeCandidate).isFile() ? safeCandidate : path.join(root, 'index.html');
  response.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
  response.setHeader('cache-control', 'no-store');
  if (apiProxyTarget && path.extname(file) === '.js') {
    // Expo inlines its public variables at bundle time.  For local browser
    // validation only, route its development fallback through this same-origin
    // proxy so the browser need not access the host-only API port directly.
    response.end(fs.readFileSync(file, 'utf8').replaceAll('http://localhost:3000/api', 'http://127.0.0.1:8083/api'));
    return;
  }
  fs.createReadStream(file).pipe(response);
}).listen(8083, '127.0.0.1');
