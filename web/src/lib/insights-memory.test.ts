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
    memoriesRecalled: 1,
    runsBriefed: 1,
    runsRecalled: 4,
    flagged: [],
    ...over,
  }) as InsightsMemory;

describe('memoryTiles', () => {
  it('counts active, briefed and read memories, with the runs behind them', () => {
    expect(
      memoryTiles(memory({})).map((each) => [each.value, each.detail]),
    ).toEqual([
      ['3', 'Approved by the team'],
      ['2', 'In the briefs of 1 run'],
      ['1', 'Read in 4 runs'],
    ]);
  });
});

describe('usedNoMemory', () => {
  it('is true only where the team has, uses and flags no memory', () => {
    expect(usedNoMemory(memory({}))).toBe(false);
    expect(
      usedNoMemory(
        memory({ activeCount: 0, memoriesBriefed: 0, memoriesRecalled: 0 }),
      ),
    ).toBe(true);
  });
});
