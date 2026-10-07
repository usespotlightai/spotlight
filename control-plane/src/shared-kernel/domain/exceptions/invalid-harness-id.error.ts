export class InvalidHarnessIdError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Harness id ${reason}.`);
    this.name = 'InvalidHarnessIdError';
  }
}
