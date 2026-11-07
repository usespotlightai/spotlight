import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownStationError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(stationId: string) {
    super(`Station ${stationId} not found.`);
    this.name = 'UnknownStationError';
  }
}
