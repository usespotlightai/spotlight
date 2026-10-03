import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchReflected implements DomainEvent {
  readonly kind = 'replays.search-reflected';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
    readonly iteration: number,
    readonly endedSearch: boolean,
  ) {}
}
