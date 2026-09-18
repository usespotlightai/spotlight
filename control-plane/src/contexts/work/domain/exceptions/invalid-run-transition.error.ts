export class InvalidRunTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(`A run ${reason}`);
    this.name = 'InvalidRunTransitionError';
  }
}
