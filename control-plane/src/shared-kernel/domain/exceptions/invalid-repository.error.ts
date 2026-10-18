export class InvalidRepositoryError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Repository ${reason}.`);
    this.name = 'InvalidRepositoryError';
  }
}
