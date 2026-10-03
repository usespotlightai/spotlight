export class InvalidEffortError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Invalid effort: ${reason}`);
    this.name = 'InvalidEffortError';
  }
}
