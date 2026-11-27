import {
  type HookRedeliveries,
  REDELIVER_EVERY_MS,
} from '@github/application/services/hook-redeliveries.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Leadership } from '@platform/redis/leadership';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

@Injectable()
export class RedeliverHookDeliveriesWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly redeliveries: HookRedeliveries,
    private readonly receivesWebhooks: boolean,
    private readonly leadership: Leadership,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(REDELIVER_EVERY_MS)
  async tick(): Promise<void> {
    if (
      this.#ticking ||
      this.#stopped ||
      !this.receivesWebhooks ||
      !this.leadership.held()
    ) {
      return;
    }

    this.#ticking = this.redeliveries.redeliver().catch((error: unknown) => {
      this.logger.error(
        { err: error },
        'Redelivering failed GitHub webhook deliveries',
      );
    });
    await this.#ticking;
    this.#ticking = null;
  }
}
