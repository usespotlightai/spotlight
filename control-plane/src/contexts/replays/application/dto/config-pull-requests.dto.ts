export interface ConfigPullRequestReasonDto {
  readonly code: string;
  readonly message: string;
  readonly attribute: string | null;
  readonly expression: string | null;
  readonly wanted: unknown;
}

export interface CandidatePullRequestDto {
  readonly id: string;
  readonly state: string;
  readonly closedBecause: string | null;
  readonly closeFailure: ConfigPullRequestReasonDto | null;
  readonly url: string | null;
  readonly reason: ConfigPullRequestReasonDto | null;
}
