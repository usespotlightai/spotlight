import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';

export class RunBriefed implements DomainEvent {
  readonly kind = 'run.briefed';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId | null,
    readonly memories: BriefedMemories,
  ) {}
}
