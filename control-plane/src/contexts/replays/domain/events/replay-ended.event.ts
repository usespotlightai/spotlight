import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayEnded implements DomainEvent {
  readonly kind = 'replays.replay-ended';

  constructor(
    readonly replayId: ReplayId,
    readonly workspaceId: WorkspaceId,
    readonly searchId: SearchId | null,
    readonly state: ReplayStopReason,
  ) {}
}
