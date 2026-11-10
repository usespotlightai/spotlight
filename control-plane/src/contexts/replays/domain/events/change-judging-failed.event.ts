import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ChangeJudgingFailed implements DomainEvent {
  readonly kind = 'change-judging.failed';

  constructor(
    readonly runId: RunId,
    readonly attempt: JudgingAttempt,
    readonly workspaceId: WorkspaceId,
    readonly failure: JudgingFailure,
  ) {}
}
