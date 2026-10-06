export class PullRequestMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(pullRequest: string) {
    super(
      `Pull request ${pullRequest} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'PullRequestMovedOnError';
  }
}
