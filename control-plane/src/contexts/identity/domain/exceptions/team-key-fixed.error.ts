export class TeamKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`The ${key} team ${because}`);
    this.name = 'TeamKeyFixedError';
  }
}
