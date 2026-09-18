import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';

export class StationRenamed implements DomainEvent {
  readonly kind = 'line.station-renamed';

  constructor(
    readonly lineId: LineId,
    readonly stationId: StationId,
    readonly from: StationName,
    readonly to: StationName,
  ) {}
}
