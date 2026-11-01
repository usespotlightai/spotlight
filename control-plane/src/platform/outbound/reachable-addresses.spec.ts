import { unreachable } from '@platform/outbound/reachable-addresses';
import { describe, expect, it } from 'vitest';

describe('unreachable', () => {
  it.each([
    '169.254.169.254',
    'fe80::1',
    '0.0.0.0',
    '0.1.2.3',
    '224.0.0.1',
    'ff02::1',
    '::',
    '::ffff:169.254.169.254',
  ])('never calls %s, even for a named host', (address) => {
    expect(unreachable(address, true)).toMatch(/never calls/);
  });

  it.each([
    '10.0.0.7',
    '192.168.1.20',
    '172.18.0.3',
    'fd00:ec2::254',
    '100.100.100.200',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
    '2002:a00:1::',
  ])('calls the private address %s only for a named host', (address) => {
    expect(unreachable(address, false)).toMatch(/private address/);
    expect(unreachable(address, true)).toBeNull();
  });

  it.each(['140.82.112.3', '2606:4700::6810:85e5'])(
    'calls the public address %s',
    (address) => {
      expect(unreachable(address, false)).toBeNull();
    },
  );

  it.each(['127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'])(
    'calls the loopback address %s only when loopback is allowed',
    (address) => {
      expect(unreachable(address, true)).toMatch(
        /SPOTLIGHT_OUTBOUND_ALLOW_LOOPBACK/,
      );
    },
  );

  it('calls a loopback address only when loopback is allowed and the host is named', () => {
    expect(unreachable('127.0.0.1', true)).toMatch(/loopback address/);
    expect(unreachable('127.0.0.1', false, true)).toMatch(/names/);
    expect(unreachable('127.0.0.1', true, true)).toBeNull();
    expect(unreachable('::1', true, true)).toBeNull();
    expect(unreachable('169.254.169.254', true, true)).toMatch(/never calls/);
  });
});
