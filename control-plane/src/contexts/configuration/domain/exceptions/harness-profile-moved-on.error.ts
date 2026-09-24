export class HarnessProfileMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The ${key} harness profile was defined again while this was`);
    this.name = 'HarnessProfileMovedOnError';
  }
}
