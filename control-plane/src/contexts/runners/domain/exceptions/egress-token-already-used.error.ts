export class EgressTokenAlreadyUsedError extends Error {
  readonly kind = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'was used before. Each egress token is single-use. Please use a new token';

  constructor() {
    super(
      'Egress token was used before. Each egress token is single-use. Please use a new token.',
    );
    this.name = 'EgressTokenAlreadyUsedError';
  }
}
