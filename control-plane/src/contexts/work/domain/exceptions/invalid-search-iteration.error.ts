export class InvalidSearchIterationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(iteration: unknown) {
    super(`A search iteration is counted from one, not ${String(iteration)}`);
    this.name = 'InvalidSearchIterationError';
  }
}
