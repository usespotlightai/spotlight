import {
  countsOf,
  originalOutcomeOf,
} from '@replays/domain/services/composition';
import { describe, expect, it } from 'vitest';

describe('countsOf', () => {
  it('counts every outcome, in one order, even those no original had', () => {
    expect(countsOf(['accepted', 'failed', 'failed'])).toEqual([
      { outcome: 'accepted', count: 1 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 2 },
      { outcome: 'other', count: 0 },
    ]);
  });
});

describe('originalOutcomeOf', () => {
  it('takes an original no outcome is known for as some other outcome', () => {
    const known = new Map([['run_1', 'accepted' as const]]);

    expect(originalOutcomeOf(known, 'run_1')).toBe('accepted');
    expect(originalOutcomeOf(known, 'run_2')).toBe('other');
  });
});
