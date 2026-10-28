import { describe, expect, it } from 'vitest';
import {
  durationWords,
  type SearchPolicy,
  searchPolicyDetail,
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

describe('searchPolicyDetail', () => {
  it('names the ceiling of one search and how often it runs', () => {
    expect(searchPolicyDetail(POLICY)).toBe(
      'Up to $10 a search · every 7 days',
    );
  });

  it('says no search runs when automatic improvement is off', () => {
    expect(searchPolicyDetail({ ...POLICY, enabled: false })).toBe(
      'No automatic searches',
    );
  });
});

describe('searchPolicyNote', () => {
  it('says what Spotlight picks where the station leaves it out', () => {
    expect(searchPolicyNote(POLICY).rows).toEqual([
      ['Line ceiling a month', '$50'],
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
      ['Line ceiling a month', '$50'],
      ['After an alert', "Doesn't start a search"],
      ['Cooldown', '3 days'],
      ['Agent', 'claude-code, high'],
      ['Iterations', '4'],
      ['Repeats', '2'],
      ['Objective', 'The same success for less'],
    ]);
  });
});
