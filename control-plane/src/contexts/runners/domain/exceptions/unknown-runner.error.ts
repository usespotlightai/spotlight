export class UnknownRunnerError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runnerId: string) {
    super(`runner ${runnerId} is not enrolled`);
    this.name = 'UnknownRunnerError';
  }
}
