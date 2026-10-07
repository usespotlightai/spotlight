export class LineKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`Key of line ${key} ${because}.`);
    this.name = 'LineKeyFixedError';
  }
}
