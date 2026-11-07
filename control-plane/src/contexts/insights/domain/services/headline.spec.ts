import {
  type Headline,
  headlineDeltasOf,
} from '@insights/domain/services/headline';
import { describe, expect, it } from 'vitest';

const headline = (over: Partial<Headline> = {}): Headline => ({
  spend: { amount: 10, currency: 'USD' },
  unpriced: 0,
  mixedCurrencies: false,
  runs: 10,
  tasks: 5,
  mergedPullRequests: 4,
  closedPullRequests: 1,
  mergeRate: 0.8,
  costPerMerge: { amount: 2.5, currency: 'USD' },
  taskToMerge: { p50: 3_600_000, p90: 7_200_000, count: 4 },
  humanActions: 10,
  humanActionsPerTask: 2,
  activePeople: 3,
  mergedTaskIds: [],
  peopleIds: [],
  ...over,
});

describe('headlineDeltasOf', () => {
  it('moves the merge rate by points and everything else by percent, each by its better direction', () => {
    const changes = headlineDeltasOf(
      headline({
        spend: { amount: 15, currency: 'USD' },
        mergedPullRequests: 6,
        mergeRate: 0.6,
        costPerMerge: { amount: 2, currency: 'USD' },
        taskToMerge: { p50: 7_200_000, p90: null, count: 6 },
        humanActionsPerTask: 1,
      }),
      headline(),
    );

    expect(changes.spend).toMatchObject({ by: 0.5, tone: 'flat' });
    expect(changes.mergedPullRequests).toMatchObject({ by: 0.5, tone: 'good' });
    expect(changes.mergeRate).toMatchObject({
      unit: 'points',
      direction: 'down',
      tone: 'bad',
    });
    expect(changes.mergeRate?.by).toBeCloseTo(-0.2);
    expect(changes.costPerMerge).toMatchObject({ by: -0.2, tone: 'good' });
    expect(changes.taskToMerge).toMatchObject({ by: 1, tone: 'bad' });
    expect(changes.humanActionsPerTask).toMatchObject({
      by: -0.5,
      tone: 'good',
    });
    expect(changes.activePeople?.direction).toBe('same');
  });

  it('compares no spend across currencies, nor a rate the period before did not have', () => {
    const changes = headlineDeltasOf(
      headline({ spend: { amount: 15, currency: 'EUR' } }),
      headline({ mergeRate: null, costPerMerge: null }),
    );

    expect(changes.spend).toBeNull();
    expect(changes.mergeRate).toBeNull();
    expect(changes.costPerMerge).toBeNull();
  });
});
