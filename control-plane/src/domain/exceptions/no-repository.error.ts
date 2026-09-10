export class NoRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    reason = 'This line works no repository, so there is nothing to open',
  ) {
    super(reason);
    this.name = 'NoRepositoryError';
  }
}
