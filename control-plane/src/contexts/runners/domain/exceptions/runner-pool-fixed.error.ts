export class RunnerPoolFixedError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly field: 'key' | 'provision',
    readonly because: string,
  ) {
    super(`Runner pool ${key} ${because}.`);
    this.name = 'RunnerPoolFixedError';
  }
}
