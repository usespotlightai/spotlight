import { PurgeToolUses } from '@work/application/services/purge-tool-uses.service';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T09:00:00.000Z');

describe('PurgeToolUses', () => {
  it('purges the tool uses older than seven days, batch by batch', async () => {
    const asked: { before: Date; max: number }[] = [];
    const batches = [5_000, 12];

    const purged = await new PurgeToolUses(
      {
        record: async () => {},
        purgeBefore: async (before, max) => {
          asked.push({ before, max });
          return batches.shift() ?? 0;
        },
      },
      { now: () => NOW, sleep: async () => {} },
    ).purge();

    expect(purged).toBe(5_012);
    expect(asked).toEqual([
      { before: new Date('2026-10-31T09:00:00.000Z'), max: 5_000 },
      { before: new Date('2026-10-31T09:00:00.000Z'), max: 5_000 },
    ]);
  });
});
