import { describe, expect, it } from 'vitest';
import {
  estimateAskedOf,
  estimateKey,
  estimateRefusalOf,
  FIRST_BUDGET,
  harnessOf,
  objectiveOf,
  objectiveSuggestionOf,
  saturatedRateOf,
  searchProblemOf,
} from '@/lib/search-start';

const BUDGET = {
  iterations: 3,
  perIteration: 2,
  concurrency: 4,
  repeats: 1,
  ceiling: null,
} as unknown as Parameters<typeof estimateKey>[1];

describe('harnessOf', () => {
  const harnesses = [{ id: 'one' }, { id: 'two' }] as unknown as Parameters<
    typeof harnessOf
  >[0];

  it('keeps an offered choice, else takes the first offered', () => {
    expect(harnessOf(harnesses, 'two')).toBe('two');
    expect(harnessOf(harnesses, 'gone')).toBe('one');
    expect(harnessOf(undefined, 'two')).toBe('');
  });
});

describe('estimateKey', () => {
  it('round-trips what the estimate is asked for', () => {
    const key = estimateKey('set_1', BUDGET);

    expect(estimateAskedOf(key)).toEqual({ setId: 'set_1', budget: BUDGET });
    expect(estimateKey('', BUDGET)).toBeNull();
    expect(estimateKey('set_1', null)).toBeNull();
    expect(estimateAskedOf(null)).toBeNull();
  });
});

describe('searchProblemOf', () => {
  const sources = {
    problems: { iterations: 'Too many.' },
    inputs: { ...FIRST_BUDGET, iterations: '' },
    tried: false,
    refused: [{ agent: 'Refused.' }, { agent: 'Later.', set: 'Gone.' }],
  };

  it('shows a local problem once typed in or tried', () => {
    expect(searchProblemOf('iterations', sources)).toBeNull();
    expect(searchProblemOf('iterations', { ...sources, tried: true })).toBe(
      'Too many.',
    );
  });

  it('falls back to the first refusal that names the field', () => {
    expect(searchProblemOf('agent', sources)).toBe('Refused.');
    expect(searchProblemOf('set', sources)).toBe('Gone.');
    expect(searchProblemOf('repeats', sources)).toBeNull();
  });
});

describe('objectiveOf', () => {
  const saturated = { saturated: true, rate: 0.98 } as Parameters<
    typeof objectiveOf
  >[1];

  it('keeps what was asked, else follows the set’s saturation', () => {
    expect(objectiveOf('success', saturated)).toBe('success');
    expect(objectiveOf(null, saturated)).toBe('cost');
    expect(objectiveOf(null, null)).toBe('success');
  });

  it('reads the saturated rate from the estimate first', () => {
    const suggested = {
      warnings: [{ kind: 'saturated', rate: 0.97 }],
    } as unknown as Parameters<typeof saturatedRateOf>[0];

    expect(saturatedRateOf(suggested, saturated)).toBe(0.97);
    expect(saturatedRateOf(null, saturated)).toBe(0.98);
    expect(saturatedRateOf(null, null)).toBeNull();
  });

  it('suggests an objective only when none was chosen', () => {
    expect(objectiveSuggestionOf('cost', 0.98)).toBeNull();
    expect(objectiveSuggestionOf(null, null)).toBeNull();
    expect(objectiveSuggestionOf(null, 0.98)).toContain('Suggested');
  });
});

describe('estimateRefusalOf', () => {
  it('explains a refused estimate', () => {
    expect(estimateRefusalOf(false, 'No.')).toBeNull();
    expect(estimateRefusalOf(true, 'No.')).toBe('No.');
    expect(estimateRefusalOf(true, null)).toBe(
      'Please fix the marked field to see an estimate.',
    );
  });
});
