import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTakeoverError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A takeover ${reason}.`);
    this.name = 'InvalidTakeoverError';
  }
}
