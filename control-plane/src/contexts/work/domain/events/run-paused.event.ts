import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export class RunPaused implements DomainEvent {
  readonly kind = 'run.paused';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly subject: RunSubject | null,
    readonly workedBy: RunnerId,
    readonly outcome: RunOutcome,
    readonly handover: Handover | null,
    readonly session: HarnessSession | null,
    readonly attempt: number,
    readonly at: Date,
  ) {}

  get taskId(): TaskId | null {
    return this.subject?.taskId ?? null;
  }
}
