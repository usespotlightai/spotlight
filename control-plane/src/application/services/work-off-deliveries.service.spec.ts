import type { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type {
  DeliveryInboxPort,
  StoredDelivery,
} from '@application/ports/delivery-inbox.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { WorkOffDeliveries } from '@application/services/work-off-deliveries.service';
import { describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

const waiting = (id: string): StoredDelivery => ({
  source: 'github',
  id,
  headers: {},
  body: {},
  attempts: 0,
});

const working = (
  queued: StoredDelivery[],
  react: (command: ReactToHappeningCommand) => Promise<void> = async () => {},
) => {
  const pending = [...queued];
  const worked: string[] = [];
  const failed: { id: string; because: string }[] = [];

  const inbox = {
    nextPending: vi.fn(async () => pending.shift() ?? null),
    worked: vi.fn(async (_source: string, id: string) => {
      worked.push(id);
    }),
    failed: vi.fn(async (_source: string, id: string, because: string) => {
      failed.push({ id, because });
    }),
  } as unknown as DeliveryInboxPort;

  const reacting = { execute: vi.fn(react) } as unknown as CommandHandlerPort<
    ReactToHappeningCommand,
    void
  >;

  return {
    service: new WorkOffDeliveries(inbox, reacting, transaction),
    reacting,
    worked,
    failed,
  };
};

describe('WorkOffDeliveries', () => {
  it('says there was nothing when the inbox is empty', async () => {
    const { service } = working([]);

    expect(await service.workOne()).toBe(false);
  });

  it('works the delivery it was handed, and marks it done', async () => {
    const { service, reacting, worked } = working([waiting('d_1')]);

    expect(await service.workOne()).toBe(true);
    expect(reacting.execute).toHaveBeenCalledTimes(1);
    expect(worked).toEqual(['d_1']);
  });

  it('works off everything waiting, oldest first', async () => {
    const { service, worked } = working([
      waiting('d_1'),
      waiting('d_2'),
      waiting('d_3'),
    ]);

    expect(await service.workOff()).toBe(3);
    expect(worked).toEqual(['d_1', 'd_2', 'd_3']);
  });

  it('stops at the limit it was given, leaving the rest waiting', async () => {
    const { service, worked } = working([
      waiting('d_1'),
      waiting('d_2'),
      waiting('d_3'),
    ]);

    expect(await service.workOff(2)).toBe(2);
    expect(worked).toEqual(['d_1', 'd_2']);
  });

  // A delivery that cannot be worked is a row to look at, not a webhook the
  // host was told nothing about.
  it('keeps a delivery that would not be worked, and says why', async () => {
    const { service, worked, failed } = working([waiting('d_1')], async () => {
      throw new Error('the line was read in pieces');
    });

    expect(await service.workOne()).toBe(true);
    expect(worked).toEqual([]);
    expect(failed).toEqual([
      { id: 'd_1', because: 'the line was read in pieces' },
    ]);
  });

  it('carries on with the next one after a failure', async () => {
    let seen = 0;
    const { service, worked, failed } = working(
      [waiting('d_1'), waiting('d_2')],
      async () => {
        seen += 1;
        if (seen === 1) {
          throw new Error('nope');
        }
      },
    );

    expect(await service.workOff()).toBe(2);
    expect(failed.map((each) => each.id)).toEqual(['d_1']);
    expect(worked).toEqual(['d_2']);
  });
});
