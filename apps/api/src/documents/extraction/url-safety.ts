import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BadRequestException } from '@nestjs/common';

/** Returns true for loopback / private / link-local / reserved addresses that a
 *  server-side fetch must never reach (SSRF protection). */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  if (family === 6) {
    const addr = ip.toLowerCase().split('%')[0]; // strip zone id
    if (addr === '::1' || addr === '::') return true; // loopback / unspecified
    if (addr.startsWith('fe80')) return true; // link-local
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // ULA fc00::/7
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) → validate the embedded v4.
    const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return false;
}

/** Validate a user-supplied URL for outbound fetching: http/https only, and its
 *  resolved host must be a public address. Throws BadRequestException otherwise.
 *  Returns the resolved IP so the caller can pin the connection if desired. */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Invalid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Only http(s) URLs are allowed.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // unwrap IPv6 literals
  // If the host is an IP literal, check it directly; otherwise resolve all A/AAAA.
  const addresses =
    isIP(hostname) !== 0
      ? [hostname]
      : (await lookup(hostname, { all: true }).catch(() => [])).map((r) => r.address);

  if (addresses.length === 0) {
    throw new BadRequestException('Could not resolve host.');
  }
  if (addresses.some(isPrivateAddress)) {
    throw new BadRequestException(
      'Refusing to fetch a private or loopback address.',
    );
  }
}
