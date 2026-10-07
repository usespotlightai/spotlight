export class InvalidRepositorySetupError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Repository setup ${reason}.`);
    this.name = 'InvalidRepositorySetupError';
  }
}
