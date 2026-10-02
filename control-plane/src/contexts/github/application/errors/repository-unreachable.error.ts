export class RepositoryUnreachableError extends Error {
  readonly violation = 'invalid' as const;

  constructor(repository: string) {
    super(
      `The GitHub App cannot reach ${repository}; install it on that repository, or check its name`,
    );
    this.name = 'RepositoryUnreachableError';
  }
}
