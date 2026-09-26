export class PullRequestHookRefusedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(reason: string) {
    super(
      [
        'The pull request was held back by a hook, so none was opened.',
        reason.trim(),
      ]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'PullRequestHookRefusedError';
  }
}
