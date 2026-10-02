export class UnknownConfigPullRequestError extends Error {
  readonly violation = 'not-found' as const;

  constructor(pullRequestId: string) {
    super(`There is no config pull request ${pullRequestId} for this caller`);
    this.name = 'UnknownConfigPullRequestError';
  }
}
