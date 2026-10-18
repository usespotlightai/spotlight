export class PoolTokenAlreadyUsedError extends Error {
  readonly kind = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'was used before. Each pool token is single-use. Please use a new token';

  constructor() {
    super(
      'Pool token was used before. Each pool token is single-use. Please use a new token.',
    );
    this.name = 'PoolTokenAlreadyUsedError';
  }
}
