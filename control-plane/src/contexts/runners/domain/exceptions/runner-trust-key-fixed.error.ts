export class RunnerTrustKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`The ${key} runner trust ${because}`);
    this.name = 'RunnerTrustKeyFixedError';
  }
}
