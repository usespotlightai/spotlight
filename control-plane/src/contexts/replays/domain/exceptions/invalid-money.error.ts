import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidMoneyError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Money ${reason}.`);
    this.name = 'InvalidMoneyError';
  }
}
