import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchCandidatePicked implements DomainEvent {
  readonly kind = 'replays.search-candidate-picked';

  constructor(
    readonly searchId: SearchId,
    readonly workspaceId: WorkspaceId,
    readonly candidateId: CandidateId,
  ) {}
}
