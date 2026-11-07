import type { StationKind } from '@lines/domain/entities/station.entity';
import type { StationColor } from '@lines/domain/value-objects/station-color.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';

export interface LaidOutStation {
  readonly id: StationId;
  readonly key: StationKey;
  readonly name: StationName;
  readonly kind: StationKind;
  readonly color: StationColor;
  readonly position: number;
}
