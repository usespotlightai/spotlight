export class RunnerNameFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'name';

  constructor(
    readonly name: string,
    readonly because: string,
  ) {
    super(`The runner ${name} ${because}`);
    this.name = 'RunnerNameFixedError';
  }
}
