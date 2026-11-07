import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnreadyRepositoryError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Line ${because}.`);
    this.name = 'UnreadyRepositoryError';
  }
}
