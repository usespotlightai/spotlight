import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import { detached } from '@platform/telemetry/detached';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 1000;

@Injectable()
export class EventDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #again = false;
  #stopped = false;
  #unsubscribe: (() => void) | null = null;

  constructor(
    private readonly delivery: EventDelivery,
    private readonly outbox: EventOutbox,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  onModuleInit(): void {
    this.#unsubscribe = this.outbox.onRecorded(() => {
      setImmediate(() => detached(() => void this.tick()));
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    this.#unsubscribe?.();
    await this.#ticking;
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#stopped) {
      return;
    }

    if (this.#ticking) {
      this.#again = true;
      return;
    }

    this.#ticking = this.processDue();
    await this.#ticking;
    this.#ticking = null;
  }

  private async processDue(): Promise<void> {
    try {
      do {
        this.#again = false;
        await this.delivery.processDue();
      } while (this.#again && !this.#stopped);
    } catch (error) {
      this.logger.error({ err: error }, 'Delivering domain events');
    }
  }
}
