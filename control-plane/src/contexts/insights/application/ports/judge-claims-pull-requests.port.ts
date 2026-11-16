export const JUDGE_CLAIMS_PULL_REQUESTS = Symbol(
  'INSIGHTS_JUDGE_CLAIMS_PULL_REQUESTS',
);

export interface DisagreementRunNote {
  readonly claim: number | null;
  readonly text: string;
}

export interface DisagreementRun {
  readonly runId: string;
  readonly taskId: string;
  readonly direction: 'judge-failed' | 'judge-passed';
  readonly claimsWrong: readonly number[];
  readonly notes: readonly DisagreementRunNote[];
}

interface RevisionSplitAgreement {
  readonly before: number | null;
  readonly after: number | null;
  readonly runs: number;
}

export interface JudgeClaimsPullRequest {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly revisionId: string;
  readonly trigger: 'claim-wrong' | 'calibration-failed' | 'claim-missing';
  readonly claimsBefore: readonly string[];
  readonly claimsAfter: readonly string[];
  readonly searched: RevisionSplitAgreement;
  readonly heldOut: RevisionSplitAgreement;
  readonly disagreementRuns: readonly DisagreementRun[];
}

export interface JudgeClaimsPullRequestsPort {
  request(request: JudgeClaimsPullRequest): Promise<void>;
}
