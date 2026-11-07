import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStationSearchError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(because: string) {
    super(`Line ${because}.`);
    this.name = 'InvalidStationSearchError';
  }
}
