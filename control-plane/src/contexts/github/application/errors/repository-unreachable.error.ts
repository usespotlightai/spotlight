export class RepositoryUnreachableError extends Error {
  readonly violation = 'invalid' as const;

  constructor(repository: string) {
    super(
      `GitHub App cannot reach repository ${repository}. Please install it there or check the name.`,
    );
    this.name = 'RepositoryUnreachableError';
  }
}
