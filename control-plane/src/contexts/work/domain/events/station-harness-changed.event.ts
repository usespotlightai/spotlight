import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class StationHarnessChanged implements DomainEvent {
  readonly kind = 'line.station-harness-changed';

  constructor(
    readonly lineId: LineId,
    readonly stationId: StationId,
    readonly harness: HarnessId | null,
    readonly model: HarnessModel | null,
  ) {}
}
