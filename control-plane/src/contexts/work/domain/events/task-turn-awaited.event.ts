import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';

export class TaskTurnAwaited implements DomainEvent {
  readonly kind = 'task.turn-awaited';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly turn: AwaitedTurn,
  ) {}
}
