import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ImmutableFieldError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImmutableFieldError';
  }
}
