export class TeamKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`Team ${key} ${because}.`);
    this.name = 'TeamKeyFixedError';
  }
}
