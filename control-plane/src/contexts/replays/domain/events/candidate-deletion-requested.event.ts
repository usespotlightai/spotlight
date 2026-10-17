import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CandidateDeletionRequested implements DomainEvent {
  readonly kind = 'replays.candidate-deletion-requested';

  constructor(
    readonly candidateId: CandidateId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
