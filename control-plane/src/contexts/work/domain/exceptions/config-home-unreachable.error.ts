export class ConfigHomeUnreachableError extends Error {
  readonly violation = 'invalid' as const;

  constructor(repository: string) {
    super(
      `The GitHub App can't reach ${repository}. Please install it there, or pick another repository.`,
    );
    this.name = 'ConfigHomeUnreachableError';
  }
}
