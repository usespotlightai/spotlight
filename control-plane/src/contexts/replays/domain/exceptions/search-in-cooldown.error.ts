import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class SearchInCooldownError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationId: StationId, until: Date) {
    super(
      `Station ${stationId.value} started a search too recently. Next start allowed: ${until.toISOString()}`,
    );
    this.name = 'SearchInCooldownError';
  }
}
