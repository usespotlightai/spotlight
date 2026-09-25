export class InvalidRepositorySetupError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Invalid repository setup: ${reason}`);
    this.name = 'InvalidRepositorySetupError';
  }
}
