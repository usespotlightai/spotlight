import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';

export class TaskDraftSent implements DomainEvent {
  readonly kind = 'task.draft-sent';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly generation: DraftGeneration,
  ) {}
}
