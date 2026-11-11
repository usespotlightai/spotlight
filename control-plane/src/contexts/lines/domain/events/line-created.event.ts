import type { LaidOutStation } from '@lines/domain/events/laid-out-station';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class LineCreated implements ConfigurationChanged {
  readonly kind = 'line.created';

  constructor(
    readonly lineId: LineId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: LineKey,
    readonly change: ConfigurationChange,
    readonly version: number,
    readonly name: LineName,
    readonly stations: readonly LaidOutStation[],
  ) {}
}
