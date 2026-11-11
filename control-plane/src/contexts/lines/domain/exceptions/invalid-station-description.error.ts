import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationDescriptionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station description ${reason}.`);
    this.name = 'InvalidStationDescriptionError';
  }
}
