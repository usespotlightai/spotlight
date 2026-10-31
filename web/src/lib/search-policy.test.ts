import { describe, expect, it } from 'vitest';
import {
  durationWords,
  periodDays,
  type SearchPolicy,
  searchMonth,
  searchPolicyNote,
} from '@/lib/search-policy';

const POLICY: SearchPolicy = {
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  period: '7d',
  onAlert: true,
  cooldown: '3d',
  agent: null,
  iterations: null,
  repeats: null,
  objective: null,
};

describe('durationWords', () => {
  it('spells out minutes, hours and days', () => {
    expect(durationWords('90m')).toBe('90 minutes');
    expect(durationWords('1h')).toBe('1 hour');
    expect(durationWords('7d')).toBe('7 days');
  });

  it('keeps text it cannot read as written', () => {
    expect(durationWords('P7D')).toBe('P7D');
  });
});

describe('periodDays', () => {
  it('reads minutes, hours and days as days', () => {
    expect(periodDays('7d')).toBe(7);
    expect(periodDays('12h')).toBe(0.5);
    expect(periodDays('90m')).toBe(0.0625);
  });

  it('reads nothing it cannot read, or a zero period', () => {
    expect(periodDays('P7D')).toBeNull();
    expect(periodDays('0d')).toBeNull();
  });
});

describe('searchMonth', () => {
  it('starts a search only while the month has room for its whole ceiling', () => {
    expect(searchMonth({ ...POLICY, ceiling: 20 })).toEqual({
      searches: [
        { day: 0, fits: true },
        { day: 7, fits: true },
        { day: 14, fits: false },
        { day: 21, fits: false },
        { day: 28, fits: false },
      ],
      fitting: 2,
      spent: 40,
      asked: 100,
    });
  });

  it('fits every search where the month has room for them all', () => {
    expect(searchMonth(POLICY)).toMatchObject({
      fitting: 5,
      spent: 50,
      asked: 50,
    });
  });

  it('counts every search where searches are due more than once a day', () => {
    expect(searchMonth({ ...POLICY, period: '12h' })?.searches).toHaveLength(
      60,
    );
  });

  it('reads nothing where the period cannot be read', () => {
    expect(searchMonth({ ...POLICY, period: 'P7D' })).toBeNull();
  });
});

describe('searchPolicyNote', () => {
  it('says what Spotlight picks where the station leaves it out', () => {
    expect(searchPolicyNote(POLICY).rows).toEqual([
      ['After an alert', 'Starts a search'],
      ['Cooldown', '3 days'],
      ['Agent', 'Spotlight picks'],
      ['Iterations', 'Spotlight picks'],
      ['Repeats', 'Spotlight picks'],
      ['Objective', 'Station health picks'],
    ]);
  });

  it('leaves the title to its card', () => {
    expect(searchPolicyNote(POLICY).title).toBeUndefined();
  });

  it('names what the station sets', () => {
    expect(
      searchPolicyNote({
        ...POLICY,
        onAlert: false,
        agent: { harness: 'claude-code', model: null, effort: 'high' },
        iterations: 4,
        repeats: 2,
        objective: 'cost',
      }).rows,
    ).toEqual([
      ['After an alert', "Doesn't start a search"],
      ['Cooldown', '3 days'],
      ['Agent', 'claude-code, high'],
      ['Iterations', '4'],
      ['Repeats', '2'],
      ['Objective', 'The same success for less'],
    ]);
  });
});
