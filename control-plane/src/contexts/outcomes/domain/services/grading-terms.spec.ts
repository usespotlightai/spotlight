import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
  rubricOf,
} from '@outcomes/domain/judging.fake-spec';
import {
  gradingTermsOf,
  latestJudgeOf,
  visibleJudgeOf,
} from '@outcomes/domain/services/grading-terms';
import type { JudgeCalibration } from '@outcomes/domain/services/judge-calibration';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

describe('gradingTermsOf', () => {
  it('grades on the scale, rubric and claims the judge scored the run by, whatever the station says now', () => {
    const terms = gradingTermsOf(
      [
        judgeScore('run_1', ScoreScale.claims(), 0.5, {
          marks: [true, false],
        }),
      ],
      {
        scale: ScoreScale.yesNo(),
        rubricVersion: NEXT_RUBRIC_VERSION,
        rubricBody: 'Is the change small?',
      },
      rubricOf('Did it retry?', RUBRIC_VERSION, [
        'It retries the upload.',
        'It adds a test.',
      ]),
    );

    expect(terms.scale.kind).toBe('claims');
    expect(terms.rubricVersion).toBe(RUBRIC_VERSION);
    expect(terms.rubricBody).toBe('Did it retry?');
    expect(terms.claims).toEqual(['It retries the upload.', 'It adds a test.']);
  });

  it('names no claims where the rubric the judge was given is not at hand', () => {
    const terms = gradingTermsOf(
      [judgeScore('run_1', ScoreScale.claims(), 0.5, { marks: [true, false] })],
      null,
      null,
    );

    expect(terms.rubricBody).toBeNull();
    expect(terms.claims).toEqual([null, null]);
  });

  it('grades a run the judge has yet to score on the station’s current rubric', () => {
    const terms = gradingTermsOf(
      [],
      {
        scale: ScoreScale.oneToFive(),
        rubricVersion: NEXT_RUBRIC_VERSION,
        rubricBody: 'Is the change small?',
      },
      null,
    );

    expect(terms.scale.kind).toBe('number');
    expect(terms.rubricVersion).toBe(NEXT_RUBRIC_VERSION);
    expect(terms.rubricBody).toBe('Is the change small?');
  });

  it('grades yes or no where the station has no judge it can read', () => {
    expect(gradingTermsOf([], null, null)).toMatchObject({
      rubricVersion: null,
      rubricBody: null,
    });
    expect(
      gradingTermsOf(
        [],
        { scale: null, rubricVersion: RUBRIC_VERSION, rubricBody: null },
        null,
      ).scale.kind,
    ).toBe('yes-no');
  });
});

const TRUSTED: JudgeCalibration = {
  trusted: true,
  measure: 'kappa',
  agreement: 0.9,
  pairs: 12,
  trust: 0.5,
  hiddenBecause: null,
};

describe('visibleJudgeOf', () => {
  const AT = new Date('2026-09-30T10:00:00.000Z');
  const LATER = new Date('2026-09-30T12:00:00.000Z');

  it('shows the judge’s score by the current rubric while that rubric’s judge is trusted', () => {
    const scores = [
      judgeScore('run_1', ScoreScale.yesNo(), 1, { at: AT }),
      judgeScore('run_1', ScoreScale.yesNo(), 0, {
        at: LATER,
        rubricVersion: NEXT_RUBRIC_VERSION,
      }),
    ];

    expect(visibleJudgeOf(scores, TRUSTED, RUBRIC_VERSION)?.value).toBe(1);
  });

  it('shows no score by an earlier rubric, however trusted the current one', () => {
    const scores = [judgeScore('run_1', ScoreScale.yesNo(), 1)];

    expect(visibleJudgeOf(scores, TRUSTED, NEXT_RUBRIC_VERSION)).toBeNull();
  });

  it('shows nothing while the judge is not trusted', () => {
    const scores = [judgeScore('run_1', ScoreScale.yesNo(), 1)];

    expect(
      visibleJudgeOf(
        scores,
        { ...TRUSTED, trusted: false, hiddenBecause: 'below-trust' },
        RUBRIC_VERSION,
      ),
    ).toBeNull();
    expect(visibleJudgeOf(scores, TRUSTED, null)).toBeNull();
  });
});

describe('latestJudgeOf', () => {
  it('orders two scores given at the same moment by their ids', () => {
    const scores = [
      judgeScore('run_1', ScoreScale.yesNo(), 1),
      judgeScore('run_1', ScoreScale.yesNo(), 0, {
        rubricVersion: NEXT_RUBRIC_VERSION,
      }),
    ];

    expect(latestJudgeOf(scores)?.rubricVersion).toBe(NEXT_RUBRIC_VERSION);
    expect(latestJudgeOf([...scores].reverse())?.rubricVersion).toBe(
      NEXT_RUBRIC_VERSION,
    );
  });
});
