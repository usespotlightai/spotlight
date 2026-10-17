import type { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type {
  DeliveryInboxPort,
  StoredDelivery,
} from '@integrations/application/ports/delivery-inbox.port';
import { ProcessDueDeliveries } from '@integrations/application/services/process-due-deliveries.service';
import { MAX_DELIVERY_ATTEMPTS } from '@integrations/domain/services/delivery-retry';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const waiting = (id: string, attempts = 0): StoredDelivery => ({
  source: 'github',
  workspaceId: '',
  teamId: '',
  teamKey: '',
  id,
  headers: {},
  body: {},
  attempts,
});

const working = (
  queued: StoredDelivery[],
  react: (command: ReadDeliveryCommand) => Promise<void> = async () => {},
) => {
  const pending = [...queued];
  const worked: string[] = [];
  const failed: { id: string; because: string }[] = [];
  const retried: { id: string; because: string; at: Date }[] = [];

  const inbox = {
    claimNext: vi.fn(async () => pending.shift() ?? null),
    worked: vi.fn(async (delivered: StoredDelivery) => {
      worked.push(delivered.id);
    }),
    retryAt: vi.fn(
      async (delivered: StoredDelivery, because: string, at: Date) => {
        retried.push({ id: delivered.id, because, at });
      },
    ),
    failed: vi.fn(async (delivered: StoredDelivery, because: string) => {
      failed.push({ id: delivered.id, because });
    }),
  } as unknown as DeliveryInboxPort;

  const reacting = { execute: vi.fn(react) } as unknown as CommandHandlerPort<
    ReadDeliveryCommand,
    void
  >;

  return {
    service: new ProcessDueDeliveries(inbox, reacting, {
      now: () => NOW,
    } as ClockPort),
    inbox,
    reacting,
    worked,
    failed,
    retried,
  };
};

describe('ProcessDueDeliveries', () => {
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

    expect(await service.processDue()).toBe(3);
    expect(worked).toEqual(['d_1', 'd_2', 'd_3']);
  });

  it('stops at the limit it was given, leaving the rest waiting', async () => {
    const { service, worked } = working([
      waiting('d_1'),
      waiting('d_2'),
      waiting('d_3'),
    ]);

    expect(await service.processDue(2)).toBe(2);
    expect(worked).toEqual(['d_1', 'd_2']);
  });

  it('asks the inbox only for deliveries due now', async () => {
    const { service, inbox } = working([]);

    await service.workOne();

    expect(inbox.claimNext).toHaveBeenCalledWith(NOW);
  });

  it('puts a delivery that would not be read back to wait, and says why', async () => {
    const { service, worked, failed, retried } = working(
      [waiting('d_1')],
      async () => {
        throw new Error('the line was read in pieces');
      },
    );

    expect(await service.workOne()).toBe(true);
    expect(worked).toEqual([]);
    expect(failed).toEqual([]);
    expect(retried).toEqual([
      {
        id: 'd_1',
        because: 'the line was read in pieces',
        at: new Date(NOW.getTime() + 2_000),
      },
    ]);
  });

  it('waits longer each time the same delivery fails', async () => {
    const { service, retried } = working([waiting('d_1', 3)], async () => {
      throw new Error('nope');
    });

    await service.workOne();

    expect(retried[0]?.at).toEqual(new Date(NOW.getTime() + 16_000));
  });

  it('gives a delivery up once it has had its attempts', async () => {
    const { service, failed, retried } = working(
      [waiting('d_1', MAX_DELIVERY_ATTEMPTS - 1)],
      async () => {
        throw new Error('still nope');
      },
    );

    await service.workOne();

    expect(retried).toEqual([]);
    expect(failed).toEqual([{ id: 'd_1', because: 'still nope' }]);
  });

  it('carries on with the next one after a failure', async () => {
    let seen = 0;
    const { service, worked, retried } = working(
      [waiting('d_1'), waiting('d_2')],
      async () => {
        seen += 1;
        if (seen === 1) {
          throw new Error('nope');
        }
      },
    );

    expect(await service.processDue()).toBe(2);
    expect(retried.map((each) => each.id)).toEqual(['d_1']);
    expect(worked).toEqual(['d_2']);
  });
});
