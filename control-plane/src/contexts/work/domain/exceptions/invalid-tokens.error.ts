import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTokensError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(count: number) {
    super(`Token count must be a whole number from 0. Value: ${count}`);
    this.name = 'InvalidTokensError';
  }
}
