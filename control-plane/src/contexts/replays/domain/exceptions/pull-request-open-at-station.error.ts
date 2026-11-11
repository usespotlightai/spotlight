import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class PullRequestOpenAtStationError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationId: StationId) {
    super(
      `Station ${stationId.value} has an open config pull request already. Please merge or close it first.`,
    );
    this.name = 'PullRequestOpenAtStationError';
  }
}
