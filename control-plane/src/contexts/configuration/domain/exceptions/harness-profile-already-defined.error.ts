export class HarnessProfileAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The team already has a ${key} harness profile`);
    this.name = 'HarnessProfileAlreadyDefinedError';
  }
}
