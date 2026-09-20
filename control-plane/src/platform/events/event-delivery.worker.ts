import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 1000;

@Injectable()
export class EventDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  #turning: Promise<void> | null = null;
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
      setImmediate(() => void this.turn());
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    this.#unsubscribe?.();
    await this.#turning;
  }

  @Interval(EVERY_MS)
  async turn(): Promise<void> {
    if (this.#stopped) {
      return;
    }

    if (this.#turning) {
      this.#again = true;
      return;
    }

    this.#turning = this.workOff();
    await this.#turning;
    this.#turning = null;
  }

  private async workOff(): Promise<void> {
    try {
      do {
        this.#again = false;
        await this.delivery.workOff();
      } while (this.#again && !this.#stopped);
    } catch (error) {
      this.logger.error({ err: error }, 'Delivering domain events');
    }
  }
}
