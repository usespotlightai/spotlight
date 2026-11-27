import type { Leadership } from '@platform/redis/leadership';
import type { WarmSandboxKeeping } from '@runs/application/services/warm-sandbox-keeping.service';
import { WarmSandboxesWorker } from '@runs/presentation/workers/warm-sandboxes.worker';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const workerWith = (leads: boolean) => {
  const keep = vi.fn(async () => {});
  const worker = new WarmSandboxesWorker(
    partial<WarmSandboxKeeping>({ keep }),
    partial<Leadership>({ held: () => leads }),
    partial<LoggerPort>({ error: vi.fn() }),
  );

  return { worker, keep };
};

describe('WarmSandboxesWorker', () => {
  it('keeps warm sandboxes only on the instance that leads', async () => {
    const leader = workerWith(true);
    const follower = workerWith(false);

    await leader.worker.tick();
    await follower.worker.tick();

    expect(leader.keep).toHaveBeenCalledTimes(1);
    expect(follower.keep).not.toHaveBeenCalled();
  });
});
