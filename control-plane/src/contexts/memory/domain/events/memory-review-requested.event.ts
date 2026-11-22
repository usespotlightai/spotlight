import type { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class MemoryReviewRequested implements DomainEvent {
  readonly kind = 'memory-proposal-set.review-requested';

  constructor(
    readonly setId: MemoryProposalSetId,
    readonly taskId: TaskId,
    readonly runId: RunId,
  ) {}
}
