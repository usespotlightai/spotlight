export class InvalidPullRequestFilterError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Pull request filter ${reason}.`);
    this.name = 'InvalidPullRequestFilterError';
  }
}
