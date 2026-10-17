import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';
import { PurgeProcessedEvents } from '@work/application/services/purge-processed-events.service';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('PurgeProcessedEvents', () => {
  it('purges what was processed over thirty days ago, a batch at a time until none is left', async () => {
    const batches = [1_000, 1_000, 12];
    const purgeBefore = vi.fn(async () => batches.shift() ?? 0);
    const purging = new PurgeProcessedEvents(
      { purgeBefore } as unknown as ProcessedEventsPort,
      { now: () => NOW, sleep: async () => {} },
    );

    await expect(purging.purge()).resolves.toBe(2_012);
    expect(purgeBefore).toHaveBeenCalledTimes(3);
    expect(purgeBefore).toHaveBeenCalledWith(
      new Date('2026-08-27T12:00:00.000Z'),
      1_000,
    );
  });
});
