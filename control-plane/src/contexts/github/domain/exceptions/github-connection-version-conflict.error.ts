export class GitHubConnectionVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'GitHub connection changed since you loaded it. Please reload and try again.',
    );
    this.name = 'GitHubConnectionVersionConflictError';
  }
}
