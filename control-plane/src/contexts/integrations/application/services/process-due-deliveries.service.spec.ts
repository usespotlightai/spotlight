import type { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import { ProcessDueDeliveries } from '@integrations/application/services/process-due-deliveries.service';
import { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { InboundDeliveryVersionConflictError } from '@integrations/domain/exceptions/inbound-delivery-version-conflict.error';
import type { InboundDeliveryRepository } from '@integrations/domain/repositories/inbound-delivery.repository';
import { DELIVERING } from '@integrations/domain/services/delivery-retry';
import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const waiting = (id: string, attempts = 0): InboundDelivery => {
  const received = InboundDelivery.receive(
    {
      integration: IntegrationKey.of('github'),
      to: null,
      id,
      headers: {},
      body: {},
      causeFiringId: null,
    },
    NOW,
  );

  return InboundDelivery.rehydrate({
    integration: received.integration,
    to: received.to,
    id: received.id,
    headers: received.headers,
    body: received.body,
    causeFiringId: received.causeFiringId,
    receivedAt: received.receivedAt,
    progress: received.progress,
    attempts,
    failure: null,
    version: 1,
  });
};

const working = (
  queued: InboundDelivery[],
  react: (
    command: ReadDeliveryCommand,
  ) => Promise<DeliveryFailure | null> = async () => null,
  { reclaimedMeanwhile = false } = {},
) => {
  const pending = [...queued];
  const done: string[] = [];
  const failed: { id: string; because: string | null }[] = [];
  const retried: { id: string; because: string | null; at: Date }[] = [];
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const deliveries = {
    add: vi.fn(async () => true),
    claimNext: vi.fn(
      async (now: Date) => pending.shift()?.claimed(now) ?? null,
    ),
    save: vi.fn(async (delivery: InboundDelivery) => {
      if (reclaimedMeanwhile) {
        throw new InboundDeliveryVersionConflictError(delivery.id);
      }

      const { progress } = delivery;

      if (progress.kind === 'done') {
        done.push(delivery.id);
      } else if (progress.kind === 'failed') {
        failed.push({ id: delivery.id, because: delivery.failure });
      } else if (progress.kind === 'pending') {
        retried.push({
          id: delivery.id,
          because: delivery.failure,
          at: progress.dueAt,
        });
      }
    }),
  } satisfies InboundDeliveryRepository;

  const reacting = { execute: vi.fn(react) } as unknown as CommandHandlerPort<
    ReadDeliveryCommand,
    DeliveryFailure | null
  >;

  return {
    service: new ProcessDueDeliveries(
      deliveries,
      reacting,
      { now: () => NOW } as ClockPort,
      logger,
      telemetryInMemory(),
    ),
    deliveries,
    reacting,
    logger,
    done,
    failed,
    retried,
  };
};

describe('ProcessDueDeliveries', () => {
  it('says there was nothing when the queue is empty', async () => {
    const { service } = working([]);

    expect(await service.workOne()).toBe(false);
  });

  it('works the delivery it was handed, and marks it done', async () => {
    const { service, reacting, done } = working([waiting('d_1')]);

    expect(await service.workOne()).toBe(true);
    expect(reacting.execute).toHaveBeenCalledTimes(1);
    expect(done).toEqual(['d_1']);
  });

  it('works off everything waiting, oldest first', async () => {
    const { service, done } = working([
      waiting('d_1'),
      waiting('d_2'),
      waiting('d_3'),
    ]);

    expect(await service.processDue()).toBe(3);
    expect(done).toEqual(['d_1', 'd_2', 'd_3']);
  });

  it('stops at the limit it was given, leaving the rest waiting', async () => {
    const { service, done } = working([
      waiting('d_1'),
      waiting('d_2'),
      waiting('d_3'),
    ]);

    expect(await service.processDue(2)).toBe(2);
    expect(done).toEqual(['d_1', 'd_2']);
  });

  it('reads from the queue only the deliveries due now', async () => {
    const { service, deliveries } = working([]);

    await service.workOne();

    expect(deliveries.claimNext).toHaveBeenCalledWith(NOW);
  });

  it('puts a delivery that would not be read back to wait, and says why', async () => {
    const { service, done, failed, retried } = working(
      [waiting('d_1')],
      async () => DeliveryFailure.transient('the line was read in pieces'),
    );

    expect(await service.workOne()).toBe(true);
    expect(done).toEqual([]);
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
    const { service, retried } = working([waiting('d_1', 3)], async () =>
      DeliveryFailure.transient('nope'),
    );

    await service.workOne();

    expect(retried[0]?.at).toEqual(new Date(NOW.getTime() + 16_000));
  });

  it('gives a delivery up once it has had its attempts', async () => {
    const { service, failed, retried } = working(
      [waiting('d_1', DELIVERING.maxAttempts - 1)],
      async () => DeliveryFailure.transient('still nope'),
    );

    await service.workOne();

    expect(retried).toEqual([]);
    expect(failed).toEqual([{ id: 'd_1', because: 'still nope' }]);
  });

  it('gives a delivery up at once when no retry would mend it', async () => {
    const { service, failed, retried } = working([waiting('d_1')], async () =>
      DeliveryFailure.permanent('names neither a branch nor a pull request'),
    );

    await service.workOne();

    expect(retried).toEqual([]);
    expect(failed).toEqual([
      { id: 'd_1', because: 'names neither a branch nor a pull request' },
    ]);
  });

  it('gives a delivery up at once when Spotlight itself fails on it', async () => {
    const { service, failed, retried, logger } = working(
      [waiting('d_1')],
      async () => {
        throw new Error('a bug');
      },
    );

    await service.workOne();

    expect(retried).toEqual([]);
    expect(failed).toEqual([{ id: 'd_1', because: 'a bug' }]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'd_1' }),
      'A delivery failed in Spotlight',
    );
  });

  it('carries on with the next one after a failure', async () => {
    let seen = 0;
    const { service, done, retried } = working(
      [waiting('d_1'), waiting('d_2')],
      async () => {
        seen += 1;

        return seen === 1 ? DeliveryFailure.transient('nope') : null;
      },
    );

    expect(await service.processDue()).toBe(2);
    expect(retried.map((each) => each.id)).toEqual(['d_1']);
    expect(done).toEqual(['d_2']);
  });

  it('leaves a delivery to the worker that claimed it again after the lease ran out', async () => {
    const { service, logger } = working([waiting('d_1')], async () => null, {
      reclaimedMeanwhile: true,
    });

    expect(await service.workOne()).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'd_1' }),
      'A delivery was claimed again before its read finished',
    );
  });

  it('hands the reader the firing that the delivery names as its cause', async () => {
    const delivery = InboundDelivery.receive(
      {
        integration: IntegrationKey.of('github'),
        to: null,
        id: 'd_1',
        headers: {},
        body: {},
        causeFiringId: HookFiringId.of('firing_1'),
      },
      NOW,
    );
    const { service, reacting } = working([delivery]);

    await service.workOne();

    expect(reacting.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        delivered: expect.objectContaining({
          causeFiringId: HookFiringId.of('firing_1'),
        }),
      }),
    );
  });
});
