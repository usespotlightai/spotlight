export class InvalidRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Repository ${reason}.`);
    this.name = 'InvalidRepositoryError';
  }
}
