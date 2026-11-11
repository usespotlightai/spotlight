import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class StationSearchScheduleVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationId: StationId) {
    super(
      `The search schedule of station ${stationId.value} changed since it was loaded. Please try again.`,
    );
    this.name = 'StationSearchScheduleVersionConflictError';
  }
}
