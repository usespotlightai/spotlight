export class TokenTrustKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`Token trust ${key} ${because}.`);
    this.name = 'TokenTrustKeyFixedError';
  }
}
