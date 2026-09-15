import type { DomainEvent } from '@domain/events/domain-event';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { Declaration } from '@domain/value-objects/declaration.vo';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import type { RunSubject } from '@domain/value-objects/run-subject.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

export class RunCompleted implements DomainEvent {
  readonly kind = 'run.completed';

  constructor(
    readonly runId: RunId,
    readonly subject: RunSubject | null,
    readonly result: RunOutcome,
    readonly workedBy: RunnerId | null,
    readonly declared: Declaration | null,
    readonly session: HarnessSession | null,
  ) {}

  get taskId(): TaskId | null {
    return this.subject?.taskId ?? null;
  }

  get chatId(): ChatId | null {
    return this.subject?.chatId ?? null;
  }
}
