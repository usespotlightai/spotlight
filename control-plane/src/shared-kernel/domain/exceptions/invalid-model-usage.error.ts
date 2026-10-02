export class InvalidModelUsageError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A model's usage ${reason}`);
    this.name = 'InvalidModelUsageError';
  }
}
