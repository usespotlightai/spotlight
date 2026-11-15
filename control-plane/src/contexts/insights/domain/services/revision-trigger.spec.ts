import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import { MIN_PAIRS } from '@insights/domain/services/judge-calibration';
import {
  CLAIM_WRONG_TO_REVISE,
  type AnsweredDisagreement,
  NO_CLAIM_TO_REVISE,
  revisionTriggerOf,
} from '@insights/domain/services/revision-trigger';
import { describe, expect, it } from 'vitest';

const QUALIFIED: JudgeCalibration = {
  qualified: true,
  agreement: 0.8,
  pairs: 40,
  minAgreement: 0.5,
  hiddenReason: null,
};

const claimWrong = (claim: number): AnsweredDisagreement => ({
  claimsWrong: [claim],
  pointsToNoClaim: false,
});

const missing = (): AnsweredDisagreement => ({
  claimsWrong: [],
  pointsToNoClaim: true,
});

const times = <T>(count: number, make: () => T): T[] =>
  Array.from({ length: count }, make);

describe('revisionTriggerOf', () => {
  it('starts when one claim is wrong often enough', () => {
    expect(
      revisionTriggerOf({
        answers: times(CLAIM_WRONG_TO_REVISE, () => claimWrong(1)),
        calibration: QUALIFIED,
      }),
    ).toBe('claim-wrong');
  });

  it('does not add up wrong answers of different claims', () => {
    expect(
      revisionTriggerOf({
        answers: [claimWrong(0), claimWrong(1), claimWrong(2)],
        calibration: QUALIFIED,
      }),
    ).toBeNull();
  });

  it('starts when the calibration fails on enough pairs', () => {
    expect(
      revisionTriggerOf({
        answers: [],
        calibration: {
          ...QUALIFIED,
          qualified: false,
          agreement: 0.2,
          hiddenReason: 'below-min-agreement',
        },
      }),
    ).toBe('calibration-failed');
  });

  it.each(['no-agreement', 'unreadable-rubric'] as const)(
    'never starts on a judge hidden by %s',
    (hiddenReason) => {
      expect(
        revisionTriggerOf({
          answers: [],
          calibration: {
            ...QUALIFIED,
            qualified: false,
            agreement: null,
            hiddenReason,
          },
        }),
      ).toBeNull();
    },
  );

  it('waits while there are too few pairs', () => {
    expect(
      revisionTriggerOf({
        answers: [],
        calibration: {
          ...QUALIFIED,
          qualified: false,
          pairs: MIN_PAIRS - 1,
          hiddenReason: 'too-few-pairs',
        },
      }),
    ).toBeNull();
  });

  it('starts when enough problems point to no claim', () => {
    expect(
      revisionTriggerOf({
        answers: times(NO_CLAIM_TO_REVISE, missing),
        calibration: null,
      }),
    ).toBe('claim-missing');
    expect(
      revisionTriggerOf({
        answers: times(NO_CLAIM_TO_REVISE - 1, missing),
        calibration: null,
      }),
    ).toBeNull();
  });
});
