import type { DomainEvent } from '@domain/events/domain-event';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunSubject } from '@domain/value-objects/run-subject.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

export class RunAbandoned implements DomainEvent {
  readonly kind = 'run.abandoned';

  constructor(
    readonly runId: RunId,
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
