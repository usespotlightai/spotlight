export class RunnerPoolAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(
      `A runner pool keyed ${key} already exists. Please choose another key.`,
    );
    this.name = 'RunnerPoolAlreadyDefinedError';
  }
}
