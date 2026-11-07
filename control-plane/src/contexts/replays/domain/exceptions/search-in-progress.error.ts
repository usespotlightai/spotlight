import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class SearchInProgressError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationId: StationId) {
    super(
      `Station ${stationId.value} is already being searched. Please stop that search first.`,
    );
    this.name = 'SearchInProgressError';
  }
}
