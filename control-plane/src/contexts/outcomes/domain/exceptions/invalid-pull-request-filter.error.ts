export class InvalidPullRequestFilterError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Pull requests are filtered ${reason}`);
    this.name = 'InvalidPullRequestFilterError';
  }
}
