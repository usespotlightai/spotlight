import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import {
  gradeOn,
  gradingTermsOf,
  latestJudgeOf,
  onEarlierClaims,
  visibleJudgeOf,
} from '@insights/domain/services/grading-terms';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
  rubricOf,
} from '@insights/judging.fake-spec';
import { describe, expect, it } from 'vitest';

describe('gradingTermsOf', () => {
  it('grades on the claims and pass threshold the judge scored the run by, whatever the station says now', () => {
    const terms = gradingTermsOf(
      [judgeScore('run_1', [true, false], { passThreshold: 0.5 })],
      { rubric: rubricOf(NEXT_RUBRIC_VERSION, ['Is the change small?']) },
      rubricOf(RUBRIC_VERSION, ['It retries the upload.', 'It adds a test.']),
    );

    expect(terms).toEqual({
      rubricVersion: RUBRIC_VERSION,
      passThreshold: 0.5,
      claims: ['It retries the upload.', 'It adds a test.'],
    });
  });

  it('names no claims where the rubric the judge was given is not at hand', () => {
    const terms = gradingTermsOf(
      [judgeScore('run_1', [true, false])],
      null,
      null,
    );

    expect(terms?.claims).toEqual([null, null]);
  });

  it('grades a run the judge has yet to score on the station’s current claims', () => {
    const terms = gradingTermsOf(
      [],
      { rubric: rubricOf(NEXT_RUBRIC_VERSION, ['Is the change small?'], 0.5) },
      null,
    );

    expect(terms).toEqual({
      rubricVersion: NEXT_RUBRIC_VERSION,
      passThreshold: 0.5,
      claims: ['Is the change small?'],
    });
  });

  it('has no terms where neither the judge nor the station has claims', () => {
    expect(gradingTermsOf([], null, null)).toBeNull();
    expect(gradingTermsOf([], { rubric: null }, null)).toBeNull();
  });
});

describe('onEarlierClaims', () => {
  const terms = {
    rubricVersion: RUBRIC_VERSION,
    passThreshold: 1,
    claims: ['It retries the upload.'],
  };

  it('is on earlier claims only where the station judges by other claims now', () => {
    expect(onEarlierClaims(terms, NEXT_RUBRIC_VERSION)).toBe(true);
    expect(onEarlierClaims(terms, RUBRIC_VERSION)).toBe(false);
    expect(onEarlierClaims(terms, null)).toBe(false);
    expect(onEarlierClaims(null, RUBRIC_VERSION)).toBe(false);
  });
});

describe('gradeOn', () => {
  const terms = {
    rubricVersion: RUBRIC_VERSION,
    passThreshold: 0.5,
    claims: ['It retries.', 'It adds a test.'],
  };

  it('grades every claim with the terms’ pass threshold and rubric', () => {
    expect(gradeOn(terms, [true, false])).toEqual({
      claimResults: [true, false],
      passThreshold: 0.5,
      rubricVersion: RUBRIC_VERSION,
    });
  });

  it('refuses a grade that marks other claims than the terms, or has no terms', () => {
    expect(() => gradeOn(terms, [true])).toThrow(InvalidScoreError);
    expect(() => gradeOn(terms, [])).toThrow(InvalidScoreError);
    expect(() => gradeOn(null, [true])).toThrow(InvalidScoreError);
  });
});

const QUALIFIED: JudgeCalibration = {
  qualified: true,
  agreement: 0.9,
  pairs: 12,
  minAgreement: 0.5,
  hiddenReason: null,
};

describe('visibleJudgeOf', () => {
  const AT = new Date('2026-09-30T10:00:00.000Z');
  const LATER = new Date('2026-09-30T12:00:00.000Z');

  it('shows the judge’s score by the current rubric while that rubric’s judge is qualified', () => {
    const scores = [
      judgeScore('run_1', [true], { at: AT }),
      judgeScore('run_1', [false], {
        at: LATER,
        rubricVersion: NEXT_RUBRIC_VERSION,
      }),
    ];

    expect(visibleJudgeOf(scores, QUALIFIED, RUBRIC_VERSION)?.passes).toBe(
      true,
    );
  });

  it('shows no score by an earlier rubric, however qualified the current one', () => {
    const scores = [judgeScore('run_1', [true])];

    expect(visibleJudgeOf(scores, QUALIFIED, NEXT_RUBRIC_VERSION)).toBeNull();
  });

  it('shows nothing while the judge is not qualified', () => {
    const scores = [judgeScore('run_1', [true])];

    expect(
      visibleJudgeOf(
        scores,
        { ...QUALIFIED, qualified: false, hiddenReason: 'below-min-agreement' },
        RUBRIC_VERSION,
      ),
    ).toBeNull();
    expect(visibleJudgeOf(scores, QUALIFIED, null)).toBeNull();
  });
});

describe('latestJudgeOf', () => {
  it('orders two scores given at the same moment by their ids', () => {
    const scores = [
      judgeScore('run_1', [true]),
      judgeScore('run_1', [false], {
        rubricVersion: NEXT_RUBRIC_VERSION,
      }),
    ];

    expect(latestJudgeOf(scores)?.rubricVersion).toBe(NEXT_RUBRIC_VERSION);
    expect(latestJudgeOf([...scores].reverse())?.rubricVersion).toBe(
      NEXT_RUBRIC_VERSION,
    );
  });
});
