export class InvalidEffortError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Effort ${reason}.`);
    this.name = 'InvalidEffortError';
  }
}
