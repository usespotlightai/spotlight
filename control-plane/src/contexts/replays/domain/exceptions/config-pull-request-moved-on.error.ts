export class ConfigPullRequestMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(pullRequestId: string) {
    super(
      `The config pull request ${pullRequestId} changed while this was being written`,
    );
    this.name = 'ConfigPullRequestMovedOnError';
  }
}
