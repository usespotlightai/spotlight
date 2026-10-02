import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplaySetStationCheckDue implements DomainEvent {
  readonly kind = 'replays.replay-set-station-check-due';

  constructor(
    readonly setId: ReplaySetId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
