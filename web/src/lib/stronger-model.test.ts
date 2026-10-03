import { describe, expect, it } from 'vitest';
import {
  firstStrongerPicks,
  offerOf,
  problemOnceTried,
  sanityAsked,
} from '@/lib/stronger-model';

const LIVE = { harness: 'claude-code', model: 'sonnet', effort: 'low' };

describe('firstStrongerPicks', () => {
  it('starts from the seed, then the live config', () => {
    expect(firstStrongerPicks({ model: 'opus', effort: null }, LIVE)).toEqual({
      model: 'opus',
      effort: 'low',
    });
    expect(
      firstStrongerPicks(null, { harness: 'x', model: null, effort: null }),
    ).toEqual({ model: '', effort: '' });
  });
});

describe('offerOf', () => {
  it('reads the models and efforts its harness offers', () => {
    const harnesses = [
      {
        id: 'claude-code',
        models: [{ id: 'opus' }],
        efforts: ['low', 'high'],
      },
    ] as unknown as Parameters<typeof offerOf>[0];

    expect(offerOf(harnesses, 'claude-code')).toEqual({
      models: ['opus'],
      efforts: ['low', 'high'],
    });
    expect(offerOf(undefined, 'claude-code')).toEqual({
      models: [],
      efforts: [],
    });
  });
});

describe('problemOnceTried', () => {
  it('shows a problem only once the person tried', () => {
    expect(problemOnceTried(false, 'Too many.')).toBeNull();
    expect(problemOnceTried(true, 'Too many.')).toBe('Too many.');
    expect(problemOnceTried(true, 3)).toBeNull();
  });
});

describe('sanityAsked', () => {
  const ceiling = { amount: 5, currency: 'USD' };

  it('asks only when everything is ready', () => {
    expect(sanityAsked({ model: 'opus' }, null, ceiling, 2)).toEqual({
      stronger: { model: 'opus' },
      ceiling,
      repeats: 2,
    });
    expect(sanityAsked(null, null, ceiling, 2)).toBeNull();
    expect(sanityAsked({ model: 'opus' }, 'No.', ceiling, 2)).toBeNull();
    expect(sanityAsked({ model: 'opus' }, null, 'No.', 2)).toBeNull();
    expect(sanityAsked({ model: 'opus' }, null, ceiling, 'No.')).toBeNull();
  });
});
