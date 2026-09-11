export class InvalidHarnessModelError extends Error {
  constructor(reason: string) {
    super(`Invalid harness model: ${reason}`);
    this.name = 'InvalidHarnessModelError';
  }
}
