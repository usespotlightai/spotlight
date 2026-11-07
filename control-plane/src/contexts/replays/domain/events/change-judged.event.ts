import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ChangeJudged implements DomainEvent {
  readonly kind = 'replays.change-judging-judged';

  constructor(
    readonly runId: RunId,
    readonly attempt: JudgingAttempt,
    readonly workspaceId: WorkspaceId,
    readonly verdict: JudgeVerdict,
    readonly spent: ModelSpent,
    readonly at: Date,
  ) {}
}
