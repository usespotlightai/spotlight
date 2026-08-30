export class InvalidRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A repository ${reason}`);
    this.name = 'InvalidRepositoryError';
  }
}
