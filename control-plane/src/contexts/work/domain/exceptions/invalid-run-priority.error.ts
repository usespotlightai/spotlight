export class InvalidRunPriorityError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Run priority ${reason}.`);
    this.name = 'InvalidRunPriorityError';
  }
}
