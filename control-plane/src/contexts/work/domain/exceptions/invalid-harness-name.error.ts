export class InvalidHarnessNameError extends Error {
  constructor(reason: string) {
    super(`Invalid harness name: ${reason}`);
    this.name = 'InvalidHarnessNameError';
  }
}
