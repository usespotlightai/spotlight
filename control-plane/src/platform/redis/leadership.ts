import type {
  BeforeApplicationShutdown,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { Instance } from '@platform/cluster/instance';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const KEY = 'spotlight:leader';
const LEASE_MS = 30_000;
const RENEW_MS = 10_000;
const MARGIN_MS = 5_000;

const TAKE_OR_RENEW = `
if redis.call('set', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 end
if redis.call('get', KEYS[1]) == ARGV[1] then
  redis.call('pexpire', KEYS[1], ARGV[2])
  return 1
end
return 0`;

const RELEASE = `
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end
return 0`;

export interface LeaseStore {
  eval(
    script: string,
    keys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

export class Leadership
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  #heldUntil = 0;
  #renewing: Promise<void> | null = null;
  #timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly store: LeaseStore | null,
    private readonly instance: Instance,
    private readonly logger: LoggerPort,
    private readonly now: () => number = () => performance.now(),
  ) {}

  held(): boolean {
    return this.store === null || this.now() < this.#heldUntil;
  }

  onApplicationBootstrap(): void {
    if (!this.store) {
      return;
    }

    this.renew();
    this.#timer = setInterval(() => this.renew(), RENEW_MS);
    this.#timer.unref();
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.#timer);
    await this.#renewing;

    if (!this.store) {
      return;
    }

    this.#heldUntil = 0;
    await this.store
      .eval(RELEASE, 1, KEY, this.instance.id)
      .catch(() => undefined);
  }

  renew(): Promise<void> {
    this.#renewing ??= this.renewed().finally(() => {
      this.#renewing = null;
    });

    return this.#renewing;
  }

  private async renewed(): Promise<void> {
    const sent = this.now();

    try {
      const taken = await this.store?.eval(
        TAKE_OR_RENEW,
        1,
        KEY,
        this.instance.id,
        LEASE_MS,
      );
      this.#heldUntil = taken === 1 ? sent + LEASE_MS - MARGIN_MS : 0;
    } catch (error) {
      this.logger.warn({ err: error }, 'Renewing the leader lease');
    }
  }
}
