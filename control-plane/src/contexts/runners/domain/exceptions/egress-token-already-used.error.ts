import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EgressTokenAlreadyUsedError extends DomainError {
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
