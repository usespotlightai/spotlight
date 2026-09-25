export class RunnerPoolAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The workspace already has a runner pool keyed ${key}`);
    this.name = 'RunnerPoolAlreadyDefinedError';
  }
}
