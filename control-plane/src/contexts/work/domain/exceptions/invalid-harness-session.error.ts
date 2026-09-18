export class InvalidHarnessSessionError extends Error {
  constructor(reason: string) {
    super(`Invalid harness session: ${reason}`);
    this.name = 'InvalidHarnessSessionError';
  }
}
