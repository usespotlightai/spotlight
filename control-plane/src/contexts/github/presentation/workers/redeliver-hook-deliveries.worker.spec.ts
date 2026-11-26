import type { HookRedeliveries } from '@github/application/services/hook-redeliveries.service';
import { RedeliverHookDeliveriesWorker } from '@github/presentation/workers/redeliver-hook-deliveries.worker';
import type { Leadership } from '@platform/redis/leadership';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it, vi } from 'vitest';

const workerWith = (leads: boolean, receivesWebhooks = true) => {
  const redeliver = vi.fn(async () => {});
  const logger = { error: vi.fn() };
  const worker = new RedeliverHookDeliveriesWorker(
    { redeliver } as unknown as HookRedeliveries,
    receivesWebhooks,
    { held: () => leads } as unknown as Leadership,
    logger as unknown as LoggerPort,
  );

  return { worker, redeliver, logger };
};

describe('RedeliverHookDeliveriesWorker', () => {
  it('redelivers only on the instance that leads', async () => {
    const leader = workerWith(true);
    const follower = workerWith(false);

    await leader.worker.tick();
    await follower.worker.tick();

    expect(leader.redeliver).toHaveBeenCalledTimes(1);
    expect(follower.redeliver).not.toHaveBeenCalled();
  });

  it('redelivers nothing where Spotlight takes no webhook deliveries', async () => {
    const { worker, redeliver } = workerWith(true, false);

    await worker.tick();

    expect(redeliver).not.toHaveBeenCalled();
  });

  it('keeps going after a check fails', async () => {
    const { worker, redeliver, logger } = workerWith(true);
    redeliver.mockRejectedValueOnce(new Error('GitHub did not answer'));

    await worker.tick();
    await worker.tick();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(redeliver).toHaveBeenCalledTimes(2);
  });
});
