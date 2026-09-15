import { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DeliveryInboxPort } from '@application/ports/delivery-inbox.port';
import type { DeliveryWorkPort } from '@application/ports/delivery-work.port';
import type { TransactionPort } from '@application/ports/transaction.port';

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class WorkOffDeliveries implements DeliveryWorkPort {
  constructor(
    private readonly inbox: DeliveryInboxPort,
    private readonly reacting: CommandHandlerPort<
      ReactToHappeningCommand,
      void
    >,
    private readonly transaction: TransactionPort,
  ) {}

  async workOne(): Promise<boolean> {
    return this.transaction.run(async () => {
      const waiting = await this.inbox.nextPending();

      if (!waiting) {
        return false;
      }

      try {
        await this.reacting.execute(new ReactToHappeningCommand(waiting));
        await this.inbox.worked(waiting);
      } catch (error) {
        await this.inbox.failed(waiting, because(error));
      }

      return true;
    });
  }

  async workOff(limit = 100): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }
}
