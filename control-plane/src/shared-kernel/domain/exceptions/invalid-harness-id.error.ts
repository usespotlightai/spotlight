export class InvalidHarnessIdError extends Error {
  constructor(reason: string) {
    super(`Invalid harness id: ${reason}`);
    this.name = 'InvalidHarnessIdError';
  }
}
