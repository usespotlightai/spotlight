import { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DeliveryInboxPort } from '@application/ports/delivery-inbox.port';
import type { DeliveryWorkPort } from '@application/ports/delivery-work.port';
import type { TransactionPort } from '@application/ports/transaction.port';

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Works off what was taken in at the door. One delivery at a time, held for
 * as long as its own transaction runs, so two of these running side by side
 * never work the same one.
 */
export class WorkOffDeliveries implements DeliveryWorkPort {
  constructor(
    private readonly inbox: DeliveryInboxPort,
    private readonly reacting: CommandHandlerPort<
      ReactToHappeningCommand,
      void
    >,
    private readonly transaction: TransactionPort,
  ) {}

  /** True where there was one to work, so a caller knows to come again. */
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
        // Kept rather than lost, and left alone rather than tried again: a
        // delivery that cannot be worked is a row to look at, and what is
        // worth retrying is not something to guess at here.
        await this.inbox.failed(waiting, because(error));
      }

      return true;
    });
  }

  /** Everything waiting now, and no further: new arrivals wake it again. */
  async workOff(limit = 100): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }
}
