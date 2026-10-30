import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunLeases } from '@work/application/services/run-leases.service';

const EVERY_MS = 30_000;

@Injectable()
export class RunLeasesWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly leases: RunLeases,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped) {
      return;
    }

    this.#ticking = this.expire();
    await this.#ticking;
    this.#ticking = null;
  }

  private async expire(): Promise<void> {
    try {
      await this.leases.expireLeases(this.clock.now());
    } catch (error) {
      this.logger.error({ err: error }, this.leases.name);
    }
  }
}
