export class LineKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`The ${key} line ${because}`);
    this.name = 'LineKeyFixedError';
  }
}
