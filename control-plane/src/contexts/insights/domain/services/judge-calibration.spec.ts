import { claimsAgreementOf } from '@insights/domain/services/judge-agreement';
import {
  calibrationOf,
  type JudgeCalibration,
  showsJudgeOf,
  trendShownOf,
} from '@insights/domain/services/judge-calibration';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

const CURRENT = 'c'.repeat(64);

const EARLIER = 'd'.repeat(64);

const QUALIFIED: JudgeCalibration = {
  qualified: true,
  measure: 'kappa',
  agreement: 0.9,
  pairs: 12,
  minAgreement: 0.5,
  hiddenReason: null,
};

const TREND = [
  { day: '2026-09-30', judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
];

describe('showsJudgeOf', () => {
  it('shows the judge’s values only for the current rubric, and only while it is qualified', () => {
    expect(showsJudgeOf(QUALIFIED, CURRENT, CURRENT)).toBe(true);
    expect(showsJudgeOf(QUALIFIED, CURRENT, EARLIER)).toBe(false);
    expect(showsJudgeOf(QUALIFIED, null, null)).toBe(false);
    expect(
      showsJudgeOf(
        { ...QUALIFIED, qualified: false, hiddenReason: 'too-few-pairs' },
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

describe('calibrationOf a judge of claims', () => {
  it('qualifies it by its kappa over every claim', () => {
    const agreed = Array.from({ length: 10 }, (_, at) => ({
      judge: [at % 2 === 0, true],
      human: [at % 2 === 0, at % 3 !== 0],
    }));
    const agreement = claimsAgreementOf(agreed);

    expect(
      calibrationOf({
        minAgreement: 0.1,
        scale: ScoreScale.claims(),
        agreement,
      }),
    ).toMatchObject({
      measure: 'kappa',
      agreement: agreement.kappa,
      pairs: 10,
    });
  });
});
