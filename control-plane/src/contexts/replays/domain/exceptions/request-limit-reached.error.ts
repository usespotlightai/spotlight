import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class RequestLimitReachedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    stationId: StationId,
    readonly limit: number,
    readonly resetsAt: Date,
  ) {
    super(
      `The station ${stationId.value} took ${limit} requested candidates today already. The count resets at ${resetsAt.toISOString()}`,
    );
    this.name = 'RequestLimitReachedError';
  }
}
