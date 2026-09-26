import type { HeardHappeningsPort } from '@work/application/ports/heard-happenings.port';
import { ForgetHeardHappenings } from '@work/application/services/forget-heard-happenings.service';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('ForgetHeardHappenings', () => {
  it('forgets what was heard over thirty days ago, a batch at a time until none is left', async () => {
    const batches = [1_000, 1_000, 12];
    const forgetBefore = vi.fn(async () => batches.shift() ?? 0);
    const forgetting = new ForgetHeardHappenings(
      { forgetBefore } as unknown as HeardHappeningsPort,
      { now: () => NOW, sleep: async () => {} },
    );

    await expect(forgetting.forget()).resolves.toBe(2_012);
    expect(forgetBefore).toHaveBeenCalledTimes(3);
    expect(forgetBefore).toHaveBeenCalledWith(
      new Date('2026-08-27T12:00:00.000Z'),
      1_000,
    );
  });
});
