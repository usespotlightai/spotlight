export class InvalidTraceRangeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(names: readonly string[]) {
    super(`Range must be one of ${names.join(', ')}.`);
    this.name = 'InvalidTraceRangeError';
  }
}
