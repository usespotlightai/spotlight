export class RunnerTrustKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`Runner trust ${key} ${because}.`);
    this.name = 'RunnerTrustKeyFixedError';
  }
}
