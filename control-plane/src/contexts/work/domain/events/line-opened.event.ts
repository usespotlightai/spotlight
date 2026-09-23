import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LineKey } from '@work/domain/value-objects/line-key.vo';

export class LineOpened implements DomainEvent {
  readonly kind = 'line.opened';

  constructor(
    readonly lineId: LineId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: LineKey,
  ) {}
}
