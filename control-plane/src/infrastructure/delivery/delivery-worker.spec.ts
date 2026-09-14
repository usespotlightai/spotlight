import type { DeliveryWorkPort } from '@application/ports/delivery-work.port';
import type { LoggerPort } from '@application/ports/logger.port';
import { DeliveryWorker } from '@infrastructure/delivery/delivery-worker';
import { describe, expect, it, vi } from 'vitest';

const held = () => {
  let release: () => void = () => {};
  const holding = new Promise<void>((done) => {
    release = done;
  });

  return { holding, release: () => release() };
};

const turning = (workOff: () => Promise<number>) => {
  const logger = { error: vi.fn() } as unknown as LoggerPort;
  const work = { workOff: vi.fn(workOff) } as unknown as DeliveryWorkPort;

  return { worker: new DeliveryWorker(work, logger), work, logger };
};

describe('DeliveryWorker', () => {
  it('works off what is waiting when its turn comes', async () => {
    const { worker, work } = turning(async () => 2);

    await worker.turn();

    expect(work.workOff).toHaveBeenCalledTimes(1);
  });

  it('lets one turn finish before another starts', async () => {
    const { holding, release } = held();
    const { worker, work } = turning(async () => {
      await holding;
      return 1;
    });

    const first = worker.turn();
    await worker.turn();

    expect(work.workOff).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  it('takes its next turn once the last one is done', async () => {
    const { worker, work } = turning(async () => 0);

    await worker.turn();
    await worker.turn();

    expect(work.workOff).toHaveBeenCalledTimes(2);
  });

  it('starts no new turn once it is going down', async () => {
    const { worker, work } = turning(async () => 1);

    worker.onModuleDestroy();
    await worker.turn();

    expect(work.workOff).not.toHaveBeenCalled();
  });

  it('says what went wrong and takes its next turn anyway', async () => {
    let turns = 0;
    const { worker, logger } = turning(async () => {
      turns += 1;
      throw new Error('the database was away');
    });

    await expect(worker.turn()).resolves.toBeUndefined();
    await worker.turn();

    expect(turns).toBe(2);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
