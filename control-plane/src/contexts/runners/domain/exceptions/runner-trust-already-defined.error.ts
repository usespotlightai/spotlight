export class RunnerTrustAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The workspace already has a runner trust keyed ${key}`);
    this.name = 'RunnerTrustAlreadyDefinedError';
  }
}
