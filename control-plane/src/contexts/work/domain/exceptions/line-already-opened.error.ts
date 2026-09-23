export class LineAlreadyOpenedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The team already has a line keyed ${key}`);
    this.name = 'LineAlreadyOpenedError';
  }
}
