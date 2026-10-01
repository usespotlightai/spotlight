import {
  type JudgeStanding,
  showsJudgeOf,
  trendShownOf,
} from '@outcomes/domain/services/judge-standing';
import { describe, expect, it } from 'vitest';

const CURRENT = 'c'.repeat(64);

const EARLIER = 'd'.repeat(64);

const TRUSTED: JudgeStanding = {
  trusted: true,
  measure: 'kappa',
  agreement: 0.9,
  pairs: 12,
  trust: 0.5,
  hiddenBecause: null,
};

const TREND = [
  { day: '2026-09-30', judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
];

describe('showsJudgeOf', () => {
  it('shows the judge’s values only for the current rubric, and only while it is trusted', () => {
    expect(showsJudgeOf(TRUSTED, CURRENT, CURRENT)).toBe(true);
    expect(showsJudgeOf(TRUSTED, CURRENT, EARLIER)).toBe(false);
    expect(showsJudgeOf(TRUSTED, null, null)).toBe(false);
    expect(
      showsJudgeOf(
        { ...TRUSTED, trusted: false, hiddenBecause: 'too-few-pairs' },
        CURRENT,
        CURRENT,
      ),
    ).toBe(false);
  });
});

describe('trendShownOf', () => {
  it('keeps the judge’s daily mean where the judge is shown', () => {
    expect(trendShownOf(TREND, true)).toEqual(TREND);
  });

  it('leaves out the judge’s daily mean, keeping people’s, where it is hidden', () => {
    expect(trendShownOf(TREND, false)).toEqual([
      { day: '2026-09-30', judged: 4, judge: null, labelled: 3, people: 0.67 },
    ]);
  });
});
