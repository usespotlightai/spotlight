import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchIterationRequested implements DomainEvent {
  readonly kind = 'replays.search-iteration-requested';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
    readonly iteration: number,
    readonly runId: RunId,
  ) {}
}
