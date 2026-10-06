export class RunnerTrustAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(
      `A runner trust keyed ${key} already exists. Please choose another key.`,
    );
    this.name = 'RunnerTrustAlreadyDefinedError';
  }
}
