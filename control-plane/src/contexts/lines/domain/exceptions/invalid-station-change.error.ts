import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationChangeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station ${reason}.`);
    this.name = 'InvalidStationChangeError';
  }
}
