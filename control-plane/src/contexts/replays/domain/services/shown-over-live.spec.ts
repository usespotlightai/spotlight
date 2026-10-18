import {
  type CandidateRuns,
  rankedByGain,
  shownOverLive,
} from '@replays/domain/services/shown-over-live';
import { describe, expect, it } from 'vitest';

const candidate = (
  part: Partial<CandidateRuns<string>> = {},
): CandidateRuns<string> => ({
  overall: { successRate: 0.7, interval: 'overall', costPerRun: 0.3 },
  scored: 20,
  onCompared: { successRate: 0.75, interval: 'compared', costPerRun: 0.24 },
  compared: 12,
  currency: 'USD',
  live: {
    successRate: 0.6,
    interval: 'live',
    costPerRun: 0.21,
    currency: 'USD',
  },
  ...part,
});

describe('shownOverLive', () => {
  it('sets the candidate beside live on the runs both replayed', () => {
    expect(shownOverLive(candidate())).toEqual({
      basis: 'compared',
      costBasis: 'compared',
      successRate: 0.75,
      interval: 'compared',
      liveSuccessRate: 0.6,
      runs: 12,
      costPerRun: 0.24,
      liveCostPerRun: 0.21,
    });
  });

  it('shows the overall figures alone without a baseline or compared runs', () => {
    const overall = {
      basis: 'overall',
      costBasis: 'overall',
      successRate: 0.7,
      interval: 'overall',
      liveSuccessRate: null,
      runs: 20,
      costPerRun: 0.3,
      liveCostPerRun: null,
    };

    expect(shownOverLive(candidate({ live: null }))).toEqual(overall);
    expect(shownOverLive(candidate({ compared: 0 }))).toEqual(overall);
  });

  it('compares costs only in the same currency', () => {
    const shown = shownOverLive(
      candidate({
        live: {
          successRate: 0.6,
          interval: 'live',
          costPerRun: 0.21,
          currency: 'EUR',
        },
      }),
    );

    expect(shown).toMatchObject({
      basis: 'compared',
      costBasis: 'overall',
      liveSuccessRate: 0.6,
      costPerRun: 0.3,
      liveCostPerRun: null,
    });
  });
});

describe('rankedByGain', () => {
  it('leads with the largest gain and keeps those without one last, in the order they came', () => {
    const gains: Record<string, number | null> = {
      a: null,
      b: 0.05,
      c: -0.1,
      d: null,
      e: 0.2,
    };

    expect(
      rankedByGain(Object.keys(gains), (each) => gains[each] ?? null),
    ).toEqual(['e', 'b', 'c', 'a', 'd']);
  });
});
