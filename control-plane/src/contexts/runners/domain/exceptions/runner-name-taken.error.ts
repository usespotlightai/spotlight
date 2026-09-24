export class RunnerNameTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly name: string) {
    super(`The workspace already has a runner called ${name}`);
    this.name = 'RunnerNameTakenError';
  }
}
