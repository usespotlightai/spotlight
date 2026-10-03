export class InvalidHarnessModelError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Invalid harness model: ${reason}`);
    this.name = 'InvalidHarnessModelError';
  }
}
