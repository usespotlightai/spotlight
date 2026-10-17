export class HarnessProfileAlreadyExistsError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`Harness profile ${key} already exists. Please choose another key.`);
    this.name = 'HarnessProfileAlreadyExistsError';
  }
}
