import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class StationHasReplaySetError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationId: StationId) {
    super(`Station ${stationId.value} has a replay set already.`);
    this.name = 'StationHasReplaySetError';
  }
}
