export const JUDGE_CLAIMS_TRIGGERS = [
  'claim-wrong',
  'calibration-failed',
  'claim-missing',
] as const;

type JudgeClaimsTrigger = (typeof JUDGE_CLAIMS_TRIGGERS)[number];

export interface JudgeClaimsAgreement {
  readonly before: number | null;
  readonly after: number | null;
  readonly runs: number;
}

export interface JudgeClaimsDisagreementNote {
  readonly claim: number | null;
  readonly text: string;
}

export interface JudgeClaimsDisagreementRun {
  readonly runId: string;
  readonly taskId: string;
  readonly direction: 'judge-failed' | 'judge-passed';
  readonly claimsWrong: readonly number[];
  readonly notes: readonly JudgeClaimsDisagreementNote[];
}

export interface JudgeClaimsProposal {
  readonly trigger: JudgeClaimsTrigger;
  readonly claimsBefore: readonly string[];
  readonly claimsAfter: readonly string[];
  readonly searched: JudgeClaimsAgreement;
  readonly heldOut: JudgeClaimsAgreement;
  readonly disagreementRuns: readonly JudgeClaimsDisagreementRun[];
}
