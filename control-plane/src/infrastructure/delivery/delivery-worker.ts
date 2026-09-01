import type { DeliveryWorkPort } from '@application/ports/delivery-work.port';
import type { LoggerPort } from '@application/ports/logger.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

/** How often to look. A delivery waits this long at worst before it is read. */
export const EVERY_MS = 500;

/**
 * Turns the handle on the inbox. Deliveries are taken in by whichever process
 * answered the host, and worked by whichever of these gets to them first.
 */
@Injectable()
export class DeliveryWorker implements OnModuleDestroy {
  /** One turn at a time: a slow turn must not have another start beside it. */
  #turning = false;
  #stopped = false;

  constructor(
    private readonly work: DeliveryWorkPort,
    private readonly logger: LoggerPort,
  ) {}

  /**
   * On the way down, no new turn is started. A delivery caught mid-turn is
   * left as it was taken in, and worked by whoever comes up next.
   */
  onModuleDestroy(): void {
    this.#stopped = true;
  }

  @Interval(EVERY_MS)
  async turn(): Promise<void> {
    if (this.#turning || this.#stopped) {
      return;
    }

    this.#turning = true;

    try {
      await this.work.workOff();
    } catch (error) {
      // Whatever went wrong is waited out and tried again on the next turn:
      // nothing here is worth stopping the inbox over.
      this.logger.error({ err: error }, 'Working off deliveries');
    } finally {
      this.#turning = false;
    }
  }
}
