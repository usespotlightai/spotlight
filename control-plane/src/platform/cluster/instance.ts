import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const reachableAddress = (): string | undefined =>
  Object.values(networkInterfaces())
    .flat()
    .find((each) => each?.family === 'IPv4' && !each.internal)?.address;

export class Instance {
  readonly id = randomUUID();

  constructor(readonly address: string) {}

  static of(options: {
    address?: string;
    port: number;
    clustered: boolean;
  }): Instance {
    if (options.address) {
      return new Instance(options.address);
    }

    const reachable = reachableAddress();

    if (!reachable && options.clustered) {
      throw new Error(
        'Sorry, Spotlight found no network address that other control-plane instances can reach. Set SPOTLIGHT_INSTANCE_URL.',
      );
    }

    return new Instance(`http://${reachable ?? '127.0.0.1'}:${options.port}`);
  }
}
