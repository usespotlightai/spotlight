import { describe, expect, it } from 'vitest';
import {
  benchmarkShown,
  type InsightsMemory,
  memoryTiles,
  usedNoMemory,
} from '@/lib/insights-memory';

const memory = (over: Partial<InsightsMemory>): InsightsMemory =>
  ({
    standing: 3,
    memoriesBriefed: 2,
    memoriesRecalled: 1,
    runsBriefed: 1,
    runsRecalled: 4,
    flagged: [],
    ...over,
  }) as InsightsMemory;

describe('memoryTiles', () => {
  it('counts standing, briefed, read and flagged memories, with the runs behind them', () => {
    expect(
      memoryTiles(memory({})).map((each) => [each.value, each.detail]),
    ).toEqual([
      ['3', 'Kept by the team now'],
      ['2', 'to 1 run'],
      ['1', 'by 4 runs'],
      ['0', 'Retired by people this period'],
    ]);
  });
});

describe('usedNoMemory', () => {
  it('holds only where the team keeps, uses and flags no memory', () => {
    expect(usedNoMemory(memory({}))).toBe(false);
    expect(
      usedNoMemory(
        memory({ standing: 0, memoriesBriefed: 0, memoriesRecalled: 0 }),
      ),
    ).toBe(true);
  });
});

describe('benchmarkShown', () => {
  it('says how the cases went with memories and without', () => {
    expect(
      benchmarkShown({
        ranAt: '2026-09-30T00:00:00.000Z',
        withMemories: 0.8,
        withoutMemories: 0.65,
        cases: 20,
      }),
    ).toBe('80% solved with memories, 65% without, over 20 cases');
  });
});
