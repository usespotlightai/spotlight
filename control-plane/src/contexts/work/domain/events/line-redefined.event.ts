import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LineKey } from '@work/domain/value-objects/line-key.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class LineRedefined implements ConfigurationChanged {
  readonly kind = 'line.redefined';

  constructor(
    readonly lineId: LineId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: LineKey,
    readonly change: ConfigurationChange,
    readonly stationIds: readonly StationId[],
  ) {}
}
