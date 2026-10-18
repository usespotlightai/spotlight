import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { DeliveryQueuePort } from '@integrations/application/ports/delivery-queue.port';
import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import { nextDeliveryAttempt } from '@integrations/domain/services/delivery-retry';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class ProcessDueDeliveries implements DeliveryWorkPort {
  constructor(
    private readonly queue: DeliveryQueuePort,
    private readonly reading: CommandHandlerPort<ReadDeliveryCommand, void>,
    private readonly clock: ClockPort,
  ) {}

  async workOne(): Promise<boolean> {
    const waiting = await this.queue.claimNext(this.clock.now());

    if (!waiting) {
      return false;
    }

    try {
      await this.reading.execute(new ReadDeliveryCommand(waiting));
      await this.queue.markDone(waiting, this.clock.now());
    } catch (error) {
      const now = this.clock.now();
      const again = nextDeliveryAttempt(waiting.attempts + 1, now);

      if (again) {
        await this.queue.retryAt(waiting, because(error), again);
      } else {
        await this.queue.failed(waiting, because(error), now);
      }
    }

    return true;
  }

  async processDue(limit = 100): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }
}
