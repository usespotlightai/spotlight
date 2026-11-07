import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidAnswerError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`An answer ${reason}.`);
    this.name = 'InvalidAnswerError';
  }
}
