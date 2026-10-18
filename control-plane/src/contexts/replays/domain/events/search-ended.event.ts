import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchState } from '@replays/domain/value-objects/search-state';
import type { SearchStopReason } from '@replays/domain/value-objects/search-stop-reason';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchEnded implements DomainEvent {
  readonly kind = 'replays.search-ended';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
    readonly state: SearchState,
    readonly stopReason: SearchStopReason,
    readonly runToCancel: RunId | null,
    readonly stopping: readonly ReplayId[],
  ) {}
}
