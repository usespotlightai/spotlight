export interface ConfigPullRequestReasonDto {
  readonly code: string;
  readonly message: string;
  readonly attribute: string | null;
  readonly expression: string | null;
  readonly wanted: unknown;
}

export interface ConfigPullRequestDto {
  readonly id: string;
  readonly teamId: string;
  readonly searchId: string;
  readonly candidateId: string;
  readonly candidateName: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly repository: string | null;
  readonly path: string | null;
  readonly branch: string;
  readonly state: string;
  readonly url: string | null;
  readonly reason: ConfigPullRequestReasonDto | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CandidatePullRequestDto {
  readonly id: string;
  readonly state: string;
  readonly url: string | null;
  readonly reason: ConfigPullRequestReasonDto | null;
}
