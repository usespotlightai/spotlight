export class InvalidHarnessSessionError extends Error {
  constructor(reason: string) {
    super(`Harness session ${reason}.`);
    this.name = 'InvalidHarnessSessionError';
  }
}
