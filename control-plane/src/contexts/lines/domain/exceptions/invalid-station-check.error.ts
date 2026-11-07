import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationCheckError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(reason: string) {
    super(`Station check ${reason}.`);
    this.name = 'InvalidStationCheckError';
  }
}
