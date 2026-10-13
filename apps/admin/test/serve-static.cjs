const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const apiProxyTarget = process.env.ADMIN_API_PROXY_TARGET;
const hopByHopHeaders = new Set(['connection', 'content-encoding', 'content-length', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

function applySecurityHeaders(response) {
  response.setHeader('content-security-policy', "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  response.setHeader('cross-origin-opener-policy', 'same-origin');
  response.setHeader('cross-origin-resource-policy', 'same-origin');
  response.setHeader('permissions-policy', 'camera=(), geolocation=(), microphone=()');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function rewriteAdminBundle(source) {
  return source
    .replaceAll('http://localhost:3000/api', '/api')
    .replaceAll('http://127.0.0.1:8083/api', '/api');
}

function buildProxyHeaders(requestHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(requestHeaders)) {
    if (value !== undefined && !['host', 'origin'].includes(name.toLowerCase())) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  return headers;
}

async function proxyApi(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const headers = buildProxyHeaders(request.headers);
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

const server = http.createServer(async (request, response) => {
  applySecurityHeaders(response);
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (apiProxyTarget && (pathname === '/api' || pathname.startsWith('/api/'))) {
    if (!isSameOrigin(request)) {
      response.statusCode = 403;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ message: 'Cross-origin Admin API requests are not allowed.' }));
      return;
    }
    await proxyApi(request, response);
    return;
  }
  const candidate = path.resolve(root, `.${pathname}`);
  const safeCandidate = candidate.startsWith(root) ? candidate : path.join(root, 'index.html');
  const file = fs.existsSync(safeCandidate) && fs.statSync(safeCandidate).isFile() ? safeCandidate : path.join(root, 'index.html');
  response.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
  response.setHeader('cache-control', 'no-store');
  if (apiProxyTarget && path.extname(file) === '.js') {
    // Expo inlines public variables at bundle time. Route both the development
    // fallback and the private staging origin through this same-origin proxy so
    // no browser ever needs direct access to an internal API port.
    response.end(rewriteAdminBundle(fs.readFileSync(file, 'utf8')));
    return;
  }
  fs.createReadStream(file).pipe(response);
});

if (require.main === module) server.listen(8083, '127.0.0.1');

module.exports = { applySecurityHeaders, buildProxyHeaders, isSameOrigin, rewriteAdminBundle };
