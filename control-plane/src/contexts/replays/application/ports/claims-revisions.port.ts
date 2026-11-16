export interface ClaimsRevisionsPort {
  pullRequestOpened(revisionId: string, url: string): Promise<void>;

  pullRequestFailed(revisionId: string, reason: string): Promise<void>;
}
