import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchPickDecline } from '@replays/domain/value-objects/search-pick';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchPickDeclined implements DomainEvent {
  readonly kind = 'replays.search-pick-declined';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
    readonly reason: SearchPickDecline,
  ) {}
}
