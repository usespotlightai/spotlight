import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export class RunAbandoned implements DomainEvent {
  readonly kind = 'run.abandoned';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly subject: RunSubject | null,
    readonly attempt: number,
  ) {}

  get taskId(): TaskId | null {
    return this.subject?.taskId ?? null;
  }

  get chatId(): ChatId | null {
    return this.subject?.chatId ?? null;
  }
}
