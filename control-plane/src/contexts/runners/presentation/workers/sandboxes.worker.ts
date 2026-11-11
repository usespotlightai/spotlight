import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { SandboxUpkeepPort } from '@runners/application/ports/sandbox-upkeep.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 30_000;

@Injectable()
export class SandboxesWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly sandboxes: SandboxUpkeepPort,
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

    this.#ticking = this.drain();
    await this.#ticking;
    this.#ticking = null;
  }

  private async drain(): Promise<void> {
    try {
      await this.sandboxes.drainIdle(this.clock.now());
    } catch (error) {
      this.logger.error({ err: error }, 'Draining idle sandboxes');
    }
  }
}
