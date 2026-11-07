import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class UnknownSearchScheduleError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(stationId: StationId) {
    super(`Station ${stationId.value} has no search schedule.`);
    this.name = 'UnknownSearchScheduleError';
  }
}
