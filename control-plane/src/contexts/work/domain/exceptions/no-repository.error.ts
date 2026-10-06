export class NoRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason = 'Line has no repository to open.') {
    super(reason);
    this.name = 'NoRepositoryError';
  }
}
