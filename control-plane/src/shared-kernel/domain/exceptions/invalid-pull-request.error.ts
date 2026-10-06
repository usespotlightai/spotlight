export class InvalidPullRequestError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Pull request ${reason}.`);
    this.name = 'InvalidPullRequestError';
  }
}
