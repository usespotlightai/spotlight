export class InvalidRunFilterError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Runs are filtered ${reason}`);
    this.name = 'InvalidRunFilterError';
  }
}
