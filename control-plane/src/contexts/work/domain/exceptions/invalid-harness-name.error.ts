export class InvalidHarnessNameError extends Error {
  constructor(reason: string) {
    super(`Harness name ${reason}.`);
    this.name = 'InvalidHarnessNameError';
  }
}
