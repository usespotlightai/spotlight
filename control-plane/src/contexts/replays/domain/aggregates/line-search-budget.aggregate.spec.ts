import {
  ADMISSION_LEASE_MS,
  LineSearchBudget,
} from '@replays/domain/aggregates/line-search-budget.aggregate';
import { MonthlyCeilingReachedError } from '@replays/domain/exceptions/monthly-ceiling-reached.error';
import { later, NOW, STATION } from '@replays/domain/replays.fake-spec';
import { Money } from '@replays/domain/value-objects/money.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { describe, expect, it } from 'vitest';

const POLICY = SearchPolicy.of({
  enabled: true,
  monthlyCeiling: 10,
  currency: 'USD',
  ceiling: 10,
  periodMilliseconds: 1_000,
  onAlert: true,
  cooldownMilliseconds: 1_000,
  agent: null,
  iterations: 2,
  repeats: null,
  objective: null,
});

const opened = () =>
  LineSearchBudget.open({
    lineId: STATION.lineId,
    workspaceId: STATION.workspaceId,
    teamId: STATION.teamId,
    at: NOW,
  });

const admission = (id: string, admittedAt: Date) => ({
  searchId: SearchId.of(id),
  ceiling: Money.of(10, 'USD'),
  admittedAt,
});

describe('LineSearchBudget', () => {
  it('counts an admission whose search has not started yet while its lease runs', () => {
    const admitted = opened().admit(admission('search_a', NOW), POLICY, []);

    expect(() =>
      admitted.admit(
        admission('search_b', later(ADMISSION_LEASE_MS - 1)),
        POLICY,
        [],
      ),
    ).toThrow(MonthlyCeilingReachedError);
  });

  it('drops an admission whose search never started once its lease ends', () => {
    const admitted = opened()
      .admit(admission('search_a', NOW), POLICY, [])
      .admit(admission('search_b', later(ADMISSION_LEASE_MS)), POLICY, []);

    expect(admitted.admits(SearchId.of('search_a'))).toBe(false);
    expect(admitted.admits(SearchId.of('search_b'))).toBe(true);
  });

  it('withdraws exactly the one admission', () => {
    const admitted = opened()
      .admit(admission('search_a', NOW), POLICY, [])
      .withdrawn(SearchId.of('search_a'));

    expect(admitted.admissions).toEqual([]);
  });
});
