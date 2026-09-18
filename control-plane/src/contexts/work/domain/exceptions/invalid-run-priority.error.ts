export class InvalidRunPriorityError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A run priority ${reason}`);
    this.name = 'InvalidRunPriorityError';
  }
}
