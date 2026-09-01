export class InvalidPullRequestError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A pull request ${reason}`);
    this.name = 'InvalidPullRequestError';
  }
}
