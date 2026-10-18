export class EgressTokenInUseError extends Error {
  readonly kind = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'is in use by another egress. Please use a different token for each egress';

  constructor() {
    super(
      'Egress token is in use by another egress. Please use a different token for each egress.',
    );
    this.name = 'EgressTokenInUseError';
  }
}
