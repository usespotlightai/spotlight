export class ConfigPullRequestVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(pullRequestId: string) {
    super(
      `Config pull request ${pullRequestId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ConfigPullRequestVersionConflictError';
  }
}
