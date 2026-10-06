export class UnknownRunnerError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runnerId: string) {
    super(`Runner ${runnerId} not found.`);
    this.name = 'UnknownRunnerError';
  }
}
