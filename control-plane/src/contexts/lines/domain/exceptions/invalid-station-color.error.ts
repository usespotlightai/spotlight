import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationColorError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station colour ${reason}.`);
    this.name = 'InvalidStationColorError';
  }
}
