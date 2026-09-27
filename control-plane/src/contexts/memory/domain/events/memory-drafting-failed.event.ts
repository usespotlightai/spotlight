import type { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import type { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class MemoryDraftingFailed implements DomainEvent {
  readonly kind = 'memory-draft.failed';

  constructor(
    readonly draftId: MemoryDraftId,
    readonly taskId: TaskId,
    readonly runId: RunId,
    readonly failure: MemoryDraftingFailure,
  ) {}
}
