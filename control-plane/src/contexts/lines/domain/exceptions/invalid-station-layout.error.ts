import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationLayoutError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Line stations ${reason}.`);
    this.name = 'InvalidStationLayoutError';
  }
}
