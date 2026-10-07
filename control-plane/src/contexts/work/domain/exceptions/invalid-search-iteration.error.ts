export class InvalidSearchIterationError extends Error {
  readonly violation = 'invalid' as const;

  constructor(iteration: unknown) {
    super(
      `Search iteration must be a whole number from 1. Value: ${String(iteration)}`,
    );
    this.name = 'InvalidSearchIterationError';
  }
}
