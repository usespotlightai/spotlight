import type { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class MemoriesProposed implements DomainEvent {
  readonly kind = 'memory-draft.proposed';

  constructor(
    readonly draftId: MemoryDraftId,
    readonly taskId: TaskId,
    readonly runId: RunId,
    readonly proposed: number,
    readonly dropped: number,
    readonly replaced: number,
  ) {}
}
