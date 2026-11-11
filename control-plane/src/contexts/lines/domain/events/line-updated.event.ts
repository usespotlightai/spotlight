import type { LaidOutStation } from '@lines/domain/events/laid-out-station';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class LineUpdated implements ConfigurationChanged {
  readonly kind = 'line.updated';

  constructor(
    readonly lineId: LineId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: LineKey,
    readonly change: ConfigurationChange,
    readonly stationIds: readonly StationId[],
    readonly version: number,
    readonly name: LineName,
    readonly stations: readonly LaidOutStation[],
  ) {}
}
