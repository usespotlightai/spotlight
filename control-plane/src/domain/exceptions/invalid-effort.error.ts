export class InvalidEffortError extends Error {
  constructor(reason: string) {
    super(`Invalid effort: ${reason}`);
    this.name = 'InvalidEffortError';
  }
}
