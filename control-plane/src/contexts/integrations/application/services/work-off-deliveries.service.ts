import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { DeliveryInboxPort } from '@integrations/application/ports/delivery-inbox.port';
import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import { nextDeliveryAttempt } from '@integrations/domain/services/delivery-retry';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class WorkOffDeliveries implements DeliveryWorkPort {
  constructor(
    private readonly inbox: DeliveryInboxPort,
    private readonly reading: CommandHandlerPort<ReadDeliveryCommand, void>,
    private readonly clock: ClockPort,
  ) {}

  async workOne(): Promise<boolean> {
    const waiting = await this.inbox.claimNext(this.clock.now());

    if (!waiting) {
      return false;
    }

    try {
      await this.reading.execute(new ReadDeliveryCommand(waiting));
      await this.inbox.worked(waiting, this.clock.now());
    } catch (error) {
      const now = this.clock.now();
      const again = nextDeliveryAttempt(waiting.attempts + 1, now);

      if (again) {
        await this.inbox.retryAt(waiting, because(error), again);
      } else {
        await this.inbox.failed(waiting, because(error), now);
      }
    }

    return true;
  }

  async workOff(limit = 100): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }
}
