import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import { DeliveryWorker } from '@integrations/presentation/workers/delivery-worker';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it, vi } from 'vitest';

const gate = () => {
  let release: () => void = () => {};
  const opened = new Promise<void>((done) => {
    release = done;
  });

  return { opened, release: () => release() };
};

const ticking = (processDue: () => Promise<number>) => {
  const logger = { error: vi.fn() } as unknown as LoggerPort;
  const work = { processDue: vi.fn(processDue) } as unknown as DeliveryWorkPort;

  return { worker: new DeliveryWorker(work, logger), work, logger };
};

describe('DeliveryWorker', () => {
  it('works off what is waiting when its turn comes', async () => {
    const { worker, work } = ticking(async () => 2);

    await worker.tick();

    expect(work.processDue).toHaveBeenCalledTimes(1);
  });

  it('lets one turn finish before another starts', async () => {
    const { opened, release } = gate();
    const { worker, work } = ticking(async () => {
      await opened;
      return 1;
    });

    const first = worker.tick();
    await worker.tick();

    expect(work.processDue).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  it('takes its next turn once the last one is done', async () => {
    const { worker, work } = ticking(async () => 0);

    await worker.tick();
    await worker.tick();

    expect(work.processDue).toHaveBeenCalledTimes(2);
  });

  it('starts no new turn once it is going down', async () => {
    const { worker, work } = ticking(async () => 1);

    worker.onModuleDestroy();
    await worker.tick();

    expect(work.processDue).not.toHaveBeenCalled();
  });

  it('says what went wrong and takes its next turn anyway', async () => {
    let turns = 0;
    const { worker, logger } = ticking(async () => {
      turns += 1;
      throw new Error('the database was away');
    });

    await expect(worker.tick()).resolves.toBeUndefined();
    await worker.tick();

    expect(turns).toBe(2);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
