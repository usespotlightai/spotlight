import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { DeliveryQueuePort } from '@integrations/application/ports/delivery-queue.port';
import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import { nextDeliveryAttempt } from '@integrations/domain/services/delivery-retry';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class ProcessDueDeliveries implements DeliveryWorkPort {
  constructor(
    private readonly queue: DeliveryQueuePort,
    private readonly reading: CommandHandlerPort<ReadDeliveryCommand, void>,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async workOne(): Promise<boolean> {
    const waiting = await this.queue.claimNext(this.clock.now());

    if (!waiting) {
      return false;
    }

    const ids = {
      deliveryId: waiting.id,
      integration: waiting.integration,
      workspaceId: waiting.workspaceId,
      teamId: waiting.teamId,
    };

    await this.telemetry.inSpan('Reading a delivery', ids, async () => {
      try {
        await this.reading.execute(new ReadDeliveryCommand(waiting));
        await this.queue.markDone(waiting, this.clock.now());
      } catch (error) {
        const now = this.clock.now();
        const attempts = waiting.attempts + 1;
        const again = nextDeliveryAttempt(attempts, now);

        if (again) {
          this.logger.warn(
            { ...ids, err: error, attempts },
            'Reading a delivery',
          );
          await this.queue.retryAt(waiting, because(error), again);
        } else {
          this.logger.error(
            { ...ids, err: error, attempts },
            'Gave up reading a delivery',
          );
          await this.queue.failed(waiting, because(error), now);
        }
      }
    });

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
