import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidAlertError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station alert ${reason}.`);
    this.name = 'InvalidAlertError';
  }
}
