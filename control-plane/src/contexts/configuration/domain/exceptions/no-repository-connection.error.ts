export class NoRepositoryConnectionError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'This workspace has not been connected to GitHub, so nothing here can reach a repository',
    );
    this.name = 'NoRepositoryConnectionError';
  }
}
