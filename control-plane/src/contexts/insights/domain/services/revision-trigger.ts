import {
  type JudgeCalibration,
  revisesClaimsOf,
} from '@insights/domain/services/judge-calibration';

export const CLAIM_WRONG_TO_REVISE = 3;

export const NO_CLAIM_TO_REVISE = 3;

export const REVISION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export const REVISION_TRIGGERS = [
  'claim-wrong',
  'calibration-failed',
  'claim-missing',
] as const;

export type RevisionTrigger = (typeof REVISION_TRIGGERS)[number];

export interface AnsweredDisagreement {
  readonly claimsWrong: readonly number[];
  readonly pointsToNoClaim: boolean;
}

const claimsWrongOf = (
  answers: readonly AnsweredDisagreement[],
): ReadonlyMap<number, number> => {
  const counts = new Map<number, number>();

  for (const claim of answers.flatMap((each) => each.claimsWrong)) {
    counts.set(claim, (counts.get(claim) ?? 0) + 1);
  }

  return counts;
};

export const revisionTriggerOf = (input: {
  answers: readonly AnsweredDisagreement[];
  calibration: JudgeCalibration | null;
}): RevisionTrigger | null => {
  if (
    [...claimsWrongOf(input.answers).values()].some(
      (count) => count >= CLAIM_WRONG_TO_REVISE,
    )
  ) {
    return 'claim-wrong';
  }
  if (input.calibration && revisesClaimsOf(input.calibration)) {
    return 'calibration-failed';
  }
  if (
    input.answers.filter((each) => each.pointsToNoClaim).length >=
    NO_CLAIM_TO_REVISE
  ) {
    return 'claim-missing';
  }

  return null;
};
