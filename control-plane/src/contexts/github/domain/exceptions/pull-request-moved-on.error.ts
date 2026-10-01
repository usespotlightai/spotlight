export class PullRequestMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(pullRequest: string) {
    super(
      `This pull request's record changed since it was read, and cannot be written over (${pullRequest})`,
    );
    this.name = 'PullRequestMovedOnError';
  }
}
