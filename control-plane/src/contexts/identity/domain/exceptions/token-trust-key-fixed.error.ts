export class TokenTrustKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`The ${key} token trust ${because}`);
    this.name = 'TokenTrustKeyFixedError';
  }
}
