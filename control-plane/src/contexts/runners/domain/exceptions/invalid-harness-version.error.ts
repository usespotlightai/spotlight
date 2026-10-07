export class InvalidHarnessVersionError extends Error {
  constructor(readonly because: string) {
    super(`Harness version ${because}.`);
    this.name = 'InvalidHarnessVersionError';
  }
}
