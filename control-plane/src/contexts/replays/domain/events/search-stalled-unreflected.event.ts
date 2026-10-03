import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchStalledUnreflected implements DomainEvent {
  readonly kind = 'replays.search-stalled-unreflected';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
