import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationCheckError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station check ${reason}.`);
    this.name = 'InvalidStationCheckError';
  }
}
