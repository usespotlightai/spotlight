export class PullRequestHookDeniedError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(reason: string) {
    super(
      [
        'A hook stopped the pull request. No pull request was opened.',
        reason.trim(),
      ]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'PullRequestHookDeniedError';
  }
}
