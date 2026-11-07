import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTokenScopeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Token scopes ${because}.`);
    this.name = 'InvalidTokenScopeError';
  }
}
