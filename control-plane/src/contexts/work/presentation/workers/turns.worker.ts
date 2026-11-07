import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import {
  TURNS_EVERY_MS,
  type Turns,
} from '@work/application/services/turns.service';

const DAY_MS = 24 * 60 * 60_000;

@Injectable()
export class TurnsWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;
  #previously: Date;

  constructor(
    private readonly turns: Turns,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {
    this.#previously = new Date(clock.now().getTime() - TURNS_EVERY_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(TURNS_EVERY_MS)
  async tick(): Promise<void> {
    await this.ticked(async () => {
      const now = this.clock.now();

      await this.turns.retakePending(now, this.#previously);
      await this.turns.resumeAnswered(now);
      this.#previously = now;
    });
  }

  @Interval(DAY_MS)
  async daily(): Promise<void> {
    await this.ticked(() => this.turns.cancelAbandoned(this.clock.now()));
  }

  private async ticked(work: () => Promise<void>): Promise<void> {
    if (this.#ticking || this.#stopped) {
      return;
    }

    this.#ticking = work().catch((error: unknown) => {
      this.logger.error({ err: error }, 'Turns');
    });
    await this.#ticking;
    this.#ticking = null;
  }
}
