export class NoRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('This task names no repository, so there is nothing to open');
    this.name = 'NoRepositoryError';
  }
}
