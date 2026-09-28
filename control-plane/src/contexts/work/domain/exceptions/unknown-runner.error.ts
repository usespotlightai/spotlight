export class UnknownRunnerError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runnerId: string) {
    super(`runner ${runnerId} is not known`);
    this.name = 'UnknownRunnerError';
  }
}
