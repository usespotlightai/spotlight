export class ConfigFolderUnreachableError extends Error {
  readonly kind = 'invalid' as const;

  constructor(repository: string) {
    super(
      `The GitHub App can't access ${repository}. Please install it there, or pick another repository.`,
    );
    this.name = 'ConfigFolderUnreachableError';
  }
}
