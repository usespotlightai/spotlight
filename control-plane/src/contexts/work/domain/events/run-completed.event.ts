import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export class RunCompleted implements DomainEvent {
  readonly kind = 'run.completed';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly subject: RunSubject | null,
    readonly outcome: RunOutcome,
    readonly claimedBy: RunnerId | null,
    readonly handover: Handover | null,
    readonly session: HarnessSession | null,
    readonly attempt: number,
    readonly asked: boolean = false,
  ) {}

  get taskId(): TaskId | null {
    return this.subject?.taskId ?? null;
  }

  get chatId(): ChatId | null {
    return this.subject?.chatId ?? null;
  }
}
