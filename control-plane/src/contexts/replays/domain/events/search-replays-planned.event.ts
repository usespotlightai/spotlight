import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchReplaysPlanned implements DomainEvent {
  readonly kind = 'search.replays-planned';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
    readonly replayIds: readonly ReplayId[],
  ) {}
}
