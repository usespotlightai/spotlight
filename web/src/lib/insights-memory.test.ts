import { describe, expect, it } from 'vitest';

import {
  type InsightsMemory,
  memoryTiles,
  usedNoMemory,
} from '@/lib/insights-memory';

const memory = (over: Partial<InsightsMemory>): InsightsMemory =>
  ({
    activeCount: 3,
    memoriesBriefed: 2,
    memoriesRead: 1,
    memoriesRecalled: 1,
    memoriesDelivered: 2,
    runsBriefed: 1,
    runsRead: 4,
    runsRecalled: 1,
    runsDelivered: 2,
    flagged: [],
    ...over,
  }) as InsightsMemory;

describe('memoryTiles', () => {
  it('counts active, briefed, read, recalled and delivered memories, with the runs behind them', () => {
    expect(
      memoryTiles(memory({})).map((each) => [each.value, each.detail]),
    ).toEqual([
      ['3', 'Approved by the team'],
      ['2', 'In the briefs of 1 run'],
      ['1', 'From the memory folder in 4 runs'],
      ['1', 'With spotlight recall in 1 run'],
      ['2', 'At a path they are about in 2 runs'],
    ]);
  });
});

describe('usedNoMemory', () => {
  it('is true only where the team has, uses and flags no memory', () => {
    expect(usedNoMemory(memory({}))).toBe(false);
    expect(
      usedNoMemory(
        memory({
          activeCount: 0,
          memoriesBriefed: 0,
          memoriesRead: 0,
          memoriesRecalled: 0,
          memoriesDelivered: 0,
        }),
      ),
    ).toBe(true);
  });
});
