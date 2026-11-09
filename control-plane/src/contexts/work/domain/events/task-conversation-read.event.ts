import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { NotePosition } from '@work/domain/value-objects/note-position.vo';

export class TaskConversationRead implements DomainEvent {
  readonly kind = 'task.conversation-read';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly from: NotePosition,
  ) {}
}
