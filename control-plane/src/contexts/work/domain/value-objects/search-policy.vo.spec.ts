import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { InvalidSearchPolicyError } from '@work/domain/exceptions/invalid-search-policy.error';
import { Effort } from '@work/domain/value-objects/effort.vo';
import {
  LineSearchPolicy,
  SearchAgent,
  StationSearchOverride,
} from '@work/domain/value-objects/search-policy.vo';
import { describe, expect, it } from 'vitest';

const fieldOf = (made: () => unknown): string | null => {
  try {
    made();
  } catch (error) {
    if (error instanceof InvalidSearchPolicyError) {
      return error.field;
    }
    throw error;
  }

  return null;
};

describe('LineSearchPolicy', () => {
  it('is on by default, with a monthly ceiling of 50 USD and 10 USD a search every 7 days', () => {
    expect(LineSearchPolicy.DEFAULT.toPrimitives()).toEqual({
      enabled: true,
      monthlyCeiling: 50,
      currency: 'USD',
      ceiling: 10,
      period: '7d',
      onAlert: true,
      cooldown: '3d',
    });
  });

  it('fills in what it leaves out from the default, in an upper-case currency', () => {
    expect(
      LineSearchPolicy.of({
        monthlyCeiling: 80,
        currency: ' eur ',
      }).toPrimitives(),
    ).toEqual({
      ...LineSearchPolicy.DEFAULT.toPrimitives(),
      monthlyCeiling: 80,
      currency: 'EUR',
    });
  });

  it('refuses a search ceiling above the monthly ceiling', () => {
    expect(fieldOf(() => LineSearchPolicy.of({ monthlyCeiling: 5 }))).toBe(
      'ceiling',
    );
  });

  it('refuses a cooldown longer than its period', () => {
    expect(fieldOf(() => LineSearchPolicy.of({ period: '2d' }))).toBe(
      'cooldown',
    );
    expect(
      fieldOf(() => LineSearchPolicy.of({ period: '3d', cooldown: '72h' })),
    ).toBeNull();
  });

  it('names the field it refuses', () => {
    expect(fieldOf(() => LineSearchPolicy.of({ ceiling: 0 }))).toBe('ceiling');
    expect(
      fieldOf(() =>
        LineSearchPolicy.of({ monthlyCeiling: 2_000, ceiling: 1_001 }),
      ),
    ).toBe('ceiling');
    expect(fieldOf(() => LineSearchPolicy.of({ monthlyCeiling: -1 }))).toBe(
      'monthlyCeiling',
    );
    expect(fieldOf(() => LineSearchPolicy.of({ currency: 'dollars' }))).toBe(
      'currency',
    );
    expect(fieldOf(() => LineSearchPolicy.of({ period: '30m' }))).toBe(
      'period',
    );
    expect(fieldOf(() => LineSearchPolicy.of({ cooldown: 'soon' }))).toBe(
      'cooldown',
    );
  });

  it('resolves a work station’s policy, the station’s own settings first', () => {
    const resolved = LineSearchPolicy.DEFAULT.resolvedFor({
      kind: 'work',
      search: StationSearchOverride.of({
        enabled: false,
        ceiling: 20,
        cooldown: '12h',
        agent: SearchAgent.of({ harness: HarnessId.of('claude-code') }),
        iterations: 5,
        repeats: 2,
        objective: 'success',
      }),
    });

    expect(resolved).toMatchObject({
      enabled: false,
      monthlyCeiling: { amount: 50, currency: 'USD' },
      ceiling: { amount: 20, currency: 'USD' },
      period: { text: '7d' },
      onAlert: true,
      cooldown: { text: '12h' },
      iterations: 5,
      repeats: 2,
      objective: 'success',
    });
    expect(resolved?.agent?.toPrimitives()).toEqual({
      harness: 'claude-code',
      model: null,
      effort: null,
    });
  });

  it('resolves a station with no settings of its own to the line’s policy', () => {
    expect(
      LineSearchPolicy.DEFAULT.resolvedFor({ kind: 'work', search: null }),
    ).toMatchObject({
      enabled: true,
      ceiling: { amount: 10 },
      agent: null,
      iterations: null,
      repeats: null,
      objective: null,
    });
  });

  it('resolves no policy for a backlog or the completed station', () => {
    expect(
      LineSearchPolicy.DEFAULT.resolvedFor({ kind: 'backlog', search: null }),
    ).toBeNull();
    expect(
      LineSearchPolicy.DEFAULT.resolvedFor({ kind: 'completed', search: null }),
    ).toBeNull();
  });

  it('finds a station ceiling above the monthly ceiling at its ceiling', () => {
    expect(
      LineSearchPolicy.DEFAULT.overrideProblem(
        StationSearchOverride.of({ ceiling: 60 }),
      ),
    ).toEqual({
      field: 'ceiling',
      reason: expect.stringContaining('monthly ceiling, 50 USD'),
    });
    expect(
      LineSearchPolicy.DEFAULT.overrideProblem(
        StationSearchOverride.of({ ceiling: 50 }),
      ),
    ).toBeNull();
  });

  it('finds a resolved cooldown longer than the resolved period at its cooldown', () => {
    expect(
      LineSearchPolicy.DEFAULT.overrideProblem(
        StationSearchOverride.of({ period: '1d' }),
      ),
    ).toEqual({
      field: 'cooldown',
      reason: expect.stringContaining('period, 1d'),
    });
    expect(
      LineSearchPolicy.DEFAULT.overrideProblem(
        StationSearchOverride.of({ period: '1d', cooldown: '12h' }),
      ),
    ).toBeNull();
  });
});

describe('StationSearchOverride', () => {
  it('leaves every setting it does not name to the line', () => {
    expect(StationSearchOverride.of({})).toMatchObject({
      enabled: null,
      ceiling: null,
      period: null,
      onAlert: null,
      cooldown: null,
      agent: null,
      iterations: null,
      repeats: null,
      objective: null,
    });
  });

  it('takes iterations from 1 to 10 and repeats from 1 to 5', () => {
    expect(
      StationSearchOverride.of({ iterations: 10, repeats: 5 }),
    ).toMatchObject({ iterations: 10, repeats: 5 });
    expect(fieldOf(() => StationSearchOverride.of({ iterations: 11 }))).toBe(
      'iterations',
    );
    expect(fieldOf(() => StationSearchOverride.of({ iterations: 1.5 }))).toBe(
      'iterations',
    );
    expect(fieldOf(() => StationSearchOverride.of({ repeats: 6 }))).toBe(
      'repeats',
    );
  });

  it('refuses a ceiling of 0 or above 1,000', () => {
    expect(fieldOf(() => StationSearchOverride.of({ ceiling: 0 }))).toBe(
      'ceiling',
    );
    expect(fieldOf(() => StationSearchOverride.of({ ceiling: 1_001 }))).toBe(
      'ceiling',
    );
  });

  it('refuses an objective other than success or cost', () => {
    expect(
      fieldOf(() => StationSearchOverride.of({ objective: 'speed' })),
    ).toBe('objective');
  });

  it('is equal to an override with the same settings', () => {
    const agent = SearchAgent.of({
      harness: HarnessId.of('claude-code'),
      effort: Effort.of('high'),
    });

    expect(
      StationSearchOverride.of({ ceiling: 5, cooldown: '1d', agent }).equals(
        StationSearchOverride.of({ ceiling: 5, cooldown: '24h', agent }),
      ),
    ).toBe(true);
    expect(
      StationSearchOverride.of({ ceiling: 5 }).equals(
        StationSearchOverride.of({ ceiling: 5, agent }),
      ),
    ).toBe(false);
  });
});

describe('SearchAgent', () => {
  it('reads as primitives', () => {
    expect(
      SearchAgent.of({
        harness: HarnessId.of('claude-code'),
        effort: Effort.of('high'),
      }).toPrimitives(),
    ).toEqual({ harness: 'claude-code', model: null, effort: 'high' });
  });
});
