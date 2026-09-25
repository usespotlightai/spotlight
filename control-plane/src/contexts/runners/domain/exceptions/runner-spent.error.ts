export class RunnerSpentError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runnerId: string) {
    super(
      `The runner ${runnerId} has already taken its one piece of work, or ended`,
    );
    this.name = 'RunnerSpentError';
  }
}
