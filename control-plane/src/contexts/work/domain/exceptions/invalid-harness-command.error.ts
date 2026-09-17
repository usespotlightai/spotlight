export class InvalidHarnessCommandError extends Error {
  constructor(reason: string) {
    super(`Invalid harness command: ${reason}`);
    this.name = 'InvalidHarnessCommandError';
  }
}
