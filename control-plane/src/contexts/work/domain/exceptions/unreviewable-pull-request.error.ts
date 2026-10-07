export class UnreviewablePullRequestError extends Error {
  readonly violation = 'invalid' as const;

  constructor(url: string) {
    super(`Pull request ${url} has no head to check out.`);
    this.name = 'UnreviewablePullRequestError';
  }
}
