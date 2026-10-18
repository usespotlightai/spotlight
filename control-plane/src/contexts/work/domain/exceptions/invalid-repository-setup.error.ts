export class InvalidRepositorySetupError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Repository setup ${reason}.`);
    this.name = 'InvalidRepositorySetupError';
  }
}
