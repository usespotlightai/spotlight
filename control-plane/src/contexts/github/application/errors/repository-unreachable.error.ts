export class RepositoryUnreachableError extends Error {
  readonly kind = 'invalid' as const;

  constructor(repository: string) {
    super(
      `GitHub App cannot access repository ${repository}. Please install it there or check the name.`,
    );
    this.name = 'RepositoryUnreachableError';
  }
}
