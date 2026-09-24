export class InvalidHarnessVersionError extends Error {
  constructor(readonly because: string) {
    super(`Invalid harness version: ${because}`);
    this.name = 'InvalidHarnessVersionError';
  }
}
