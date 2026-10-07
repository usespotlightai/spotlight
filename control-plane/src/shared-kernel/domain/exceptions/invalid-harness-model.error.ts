export class InvalidHarnessModelError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Harness model ${reason}.`);
    this.name = 'InvalidHarnessModelError';
  }
}
