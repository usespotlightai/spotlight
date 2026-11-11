import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationNameError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station name ${reason}.`);
    this.name = 'InvalidStationNameError';
  }
}
