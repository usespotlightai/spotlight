import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Leadership } from '@platform/redis/leadership';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import {
  WARM_SANDBOXES_EVERY_MS,
  type WarmSandboxKeeping,
} from '@work/application/services/warm-sandbox-keeping.service';

@Injectable()
export class WarmSandboxesWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly keeping: WarmSandboxKeeping,
    private readonly leadership: Leadership,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(WARM_SANDBOXES_EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped || !this.leadership.held()) {
      return;
    }

    this.#ticking = this.keeping.keep().catch((error: unknown) => {
      this.logger.error({ err: error }, 'Keeping warm sandboxes');
    });
    await this.#ticking;
    this.#ticking = null;
  }
}
