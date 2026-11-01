import { BlockList, isIP } from 'node:net';

const loopback = new BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('::1', 'ipv6');

const never = new BlockList();
never.addSubnet('0.0.0.0', 8, 'ipv4');
never.addSubnet('169.254.0.0', 16, 'ipv4');
never.addSubnet('224.0.0.0', 4, 'ipv4');
never.addAddress('::', 'ipv6');
never.addSubnet('fe80::', 10, 'ipv6');
never.addSubnet('ff00::', 8, 'ipv6');

const inside = new BlockList();
inside.addSubnet('10.0.0.0', 8, 'ipv4');
inside.addSubnet('172.16.0.0', 12, 'ipv4');
inside.addSubnet('192.168.0.0', 16, 'ipv4');
inside.addSubnet('100.64.0.0', 10, 'ipv4');
inside.addSubnet('fc00::', 7, 'ipv6');
inside.addSubnet('64:ff9b::', 96, 'ipv6');
inside.addSubnet('2002::', 16, 'ipv6');

export const isAddress = (host: string): boolean =>
  isIP(host.replace(/^\[|\]$/g, '')) !== 0;

export const unreachable = (
  address: string,
  named: boolean,
  loopbackAllowed = false,
): string | null => {
  const bare = address.replace(/^\[|\]$/g, '');
  const family = isIP(bare);

  if (family === 0) {
    return 'is not an IP address.';
  }

  const type = family === 4 ? 'ipv4' : 'ipv6';

  if (never.check(bare, type)) {
    return 'is a link-local, multicast or unspecified address. Spotlight never calls such an address.';
  }

  if (loopback.check(bare, type)) {
    if (!loopbackAllowed) {
      return 'is a loopback address. Spotlight calls a loopback address only when SPOTLIGHT_OUTBOUND_ALLOW_LOOPBACK is true.';
    }

    return named
      ? null
      : 'is a loopback address. Spotlight calls a loopback address only for a host that the deployment names.';
  }

  if (!named && inside.check(bare, type)) {
    return 'is a private address. Spotlight calls a private address only for a host that the deployment names.';
  }

  return null;
};
