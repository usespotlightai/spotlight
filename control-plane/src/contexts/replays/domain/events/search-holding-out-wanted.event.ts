import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchHoldingOutWanted implements DomainEvent {
  readonly kind = 'replays.search-holding-out-wanted';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
