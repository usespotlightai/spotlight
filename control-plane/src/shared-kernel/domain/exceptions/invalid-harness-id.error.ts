export class InvalidHarnessIdError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Invalid harness id: ${reason}`);
    this.name = 'InvalidHarnessIdError';
  }
}
