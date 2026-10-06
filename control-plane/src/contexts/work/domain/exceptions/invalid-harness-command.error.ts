export class InvalidHarnessCommandError extends Error {
  constructor(reason: string) {
    super(`Harness command ${reason}.`);
    this.name = 'InvalidHarnessCommandError';
  }
}
