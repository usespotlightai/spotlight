export const CLAIMS_REVISION_PULL_REQUESTS = Symbol(
  'CLAIMS_REVISION_PULL_REQUESTS',
);

export interface ClaimsRevisionPullRequestsPort {
  opened(input: { revisionId: string; url: string }): Promise<void>;

  failed(input: { revisionId: string; reason: string }): Promise<void>;
}
