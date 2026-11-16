import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTurnHeadsError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`The heads of a turn ${reason}.`);
    this.name = 'InvalidTurnHeadsError';
  }
}
