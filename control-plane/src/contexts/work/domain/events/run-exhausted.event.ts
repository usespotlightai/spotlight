import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export class RunExhausted implements DomainEvent {
  readonly kind = 'run.exhausted';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly subject: RunSubject | null,
    readonly attempt: number,
    readonly expiredLeases: number,
    readonly asked: boolean = false,
    readonly failure: RunFailureCode | null = null,
  ) {}

  get taskId(): TaskId | null {
    return this.subject?.taskId ?? null;
  }

  get chatId(): ChatId | null {
    return this.subject?.chatId ?? null;
  }
}
