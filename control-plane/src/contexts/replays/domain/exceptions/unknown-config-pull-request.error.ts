export class UnknownConfigPullRequestError extends Error {
  readonly kind = 'not-found' as const;

  constructor(pullRequestId: string) {
    super(`Config pull request ${pullRequestId} not found.`);
    this.name = 'UnknownConfigPullRequestError';
  }
}
