export class PullRequestHookRefusedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(reason: string) {
    super(
      [
        'A hook stopped the pull request. No pull request was opened.',
        reason.trim(),
      ]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'PullRequestHookRefusedError';
  }
}
