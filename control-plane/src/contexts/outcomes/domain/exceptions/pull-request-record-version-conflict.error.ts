export class PullRequestRecordVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(pullRequest: string) {
    super(
      `Record of pull request ${pullRequest} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'PullRequestRecordVersionConflictError';
  }
}
