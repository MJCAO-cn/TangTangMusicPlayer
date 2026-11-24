import { lookup } from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';

export function isPublicNetworkAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  const family = isIP(normalized);

  if (family === 4) {
    const [a, b, c] = normalized.split('.').map(Number);
    const isNonPublic =
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113);

    return !isNonPublic;
  }

  if (family === 6) {
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('::ffff:') ||
      normalized.startsWith('2001:db8:') ||
      normalized.startsWith('2001:0:') ||
      normalized.startsWith('2002:')
    ) {
      return false;
    }

    // Only global-unicast IPv6 (2000::/3) is accepted.
    const firstHextet = Number.parseInt(normalized.split(':')[0] || '0', 16);
    return firstHextet >= 0x2000 && firstHextet <= 0x3fff;
  }

  return false;
}

function publicOnlyLookup(hostname: string, options: any, callback: (...args: any[]) => void): void {
  const requestedFamily = typeof options === 'number' ? options : options?.family || 0;

  lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }

    const candidates = addresses.filter(
      (entry) => !requestedFamily || entry.family === requestedFamily
    );

    // Reject the whole hostname if any DNS answer points to a non-public address.
    // This prevents mixed public/private answers and DNS-rebinding SSRF.
    if (
      candidates.length === 0 ||
      candidates.some((entry) => !isPublicNetworkAddress(entry.address))
    ) {
      const denied = new Error('Download host resolves to a non-public network address') as NodeJS.ErrnoException;
      denied.code = 'EACCES';
      callback(denied);
      return;
    }

    if (typeof options === 'object' && options?.all) {
      callback(null, candidates);
      return;
    }

    const selected = candidates[0];
    callback(null, selected.address, selected.family);
  });
}

export const safeHttpAgent = new http.Agent({
  keepAlive: true,
  lookup: publicOnlyLookup as any
});

export const safeHttpsAgent = new https.Agent({
  keepAlive: true,
  lookup: publicOnlyLookup as any
});
