import { describe, expect, it } from 'vitest';
import {
  runSpent,
  type StationTally,
  tallyFigures,
} from '@/lib/station-outcomes';

const tally = (over: Partial<StationTally>): StationTally => ({
  runs: 0,
  failed: 0,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  accepted: 0,
  sentBack: 0,
  withdrawn: 0,
  handedOn: 0,
  merged: 0,
  cost: null,
  medianMs: null,
  p90Ms: null,
  unpriced: 0,
  mixedCurrencies: false,
  ...over,
});

describe('tallyFigures', () => {
  it('always counts the runs, and only what happened among them', () => {
    expect(tallyFigures(tally({ runs: 4, failed: 1, merged: 2 }))).toEqual([
      { label: 'Runs', value: '4' },
      { label: 'Failed', value: '1' },
      { label: 'Merged', value: '2' },
    ]);
  });

  it('counts a single run as one', () => {
    expect(tallyFigures(tally({ runs: 1 }))[0]).toEqual({
      label: 'Run',
      value: '1',
    });
  });

  it('adds what the runs cost and how long they took', () => {
    expect(
      tallyFigures(
        tally({
          runs: 2,
          cost: { amount: 1.5, currency: 'USD' },
          medianMs: 252_000,
        }),
      ).slice(1),
    ).toEqual([
      { label: 'Cost', value: '$1.50' },
      { label: 'Median', value: '4m 12s' },
    ]);
  });
});

describe('runSpent', () => {
  it('shows a dash where a run cost nothing known', () => {
    expect(runSpent(null)).toBe('–');
    expect(
      runSpent({
        ms: 1,
        steps: 1,
        faults: 0,
        used: null,
        cost: null,
        currency: null,
      }),
    ).toBe('–');
  });
});
