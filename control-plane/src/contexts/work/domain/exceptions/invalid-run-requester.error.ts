import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunRequesterError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run requester ${reason}.`);
    this.name = 'InvalidRunRequesterError';
  }
}
