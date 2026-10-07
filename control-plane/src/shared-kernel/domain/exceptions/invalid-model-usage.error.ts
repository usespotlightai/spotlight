export class InvalidModelUsageError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Model usage ${reason}.`);
    this.name = 'InvalidModelUsageError';
  }
}
