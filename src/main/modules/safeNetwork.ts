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

export function validatePublicHttpUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8192) {
    throw new Error('Invalid network URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid network URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Only public HTTP(S) URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\\[|\\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    (isIP(hostname) !== 0 && !isPublicNetworkAddress(hostname))
  ) {
    throw new Error('Local network URLs are not allowed');
  }

  return parsed.toString();
}

export async function assertPublicHostname(hostname: string): Promise<void> {
  const normalized = hostname.toLowerCase().replace(/^\\[|\\]$/g, '');
  if (isIP(normalized) !== 0) {
    if (!isPublicNetworkAddress(normalized)) {
      throw new Error('Local network hosts are not allowed');
    }
    return;
  }

  const addresses = await new Promise<Array<{ address: string; family: number }>>(
    (resolve, reject) => {
      lookup(normalized, { all: true, verbatim: true }, (error, results) => {
        if (error) reject(error);
        else resolve(results);
      });
    }
  );

  if (
    addresses.length === 0 ||
    addresses.some((entry) => !isPublicNetworkAddress(entry.address))
  ) {
    throw new Error('Host resolves to a non-public network address');
  }
}

function publicOnlyLookup(
  hostname: string,
  options: any,
  callback: (...args: any[]) => void
): void {
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
      const denied = new Error(
        'Download host resolves to a non-public network address'
      ) as NodeJS.ErrnoException;
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
