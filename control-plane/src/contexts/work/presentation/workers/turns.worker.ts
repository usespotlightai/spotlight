import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
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

  constructor(
    private readonly turns: Turns,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(TURNS_EVERY_MS)
  async tick(): Promise<void> {
    await this.ticked(async () => {
      await this.turns.retakePending();
      await this.turns.resumeAnswered();
    });
  }

  @Interval(DAY_MS)
  async daily(): Promise<void> {
    await this.ticked(async () => {
      await this.turns.cancelAbandoned();
      await this.turns.forgetOldRetakes();
    });
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
