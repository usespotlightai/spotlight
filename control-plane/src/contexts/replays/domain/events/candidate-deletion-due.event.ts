import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CandidateDeletionDue implements DomainEvent {
  readonly kind = 'replays.candidate-deletion-due';

  constructor(
    readonly candidateId: CandidateId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
