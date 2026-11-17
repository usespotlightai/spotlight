import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import { visibleJudgeOf } from '@insights/domain/services/judge-verdict';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { describe, expect, it } from 'vitest';

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
  });

  it('shows nothing while the station has no judge', () => {
    expect(
      visibleJudgeOf([judgeScore('run_1', [true])], QUALIFIED, null),
    ).toBeNull();
  });
});
