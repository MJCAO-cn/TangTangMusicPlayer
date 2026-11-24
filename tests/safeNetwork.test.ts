import { describe, expect, it } from 'vitest';

import { isPublicNetworkAddress } from '../src/main/modules/safeNetwork';

describe('download network address policy', () => {
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '203.0.114.1',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888'
  ])('allows public address %s', (address) => {
    expect(isPublicNetworkAddress(address)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '2002:c0a8:101::1'
  ])('blocks non-public address %s', (address) => {
    expect(isPublicNetworkAddress(address)).toBe(false);
  });
});
