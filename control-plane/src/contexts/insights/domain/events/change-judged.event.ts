import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import type { JudgingAttempt } from '@insights/domain/value-objects/judging-attempt';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ChangeJudged implements DomainEvent {
  readonly kind = 'change-judging.judged';

  constructor(
    readonly runId: RunId,
    readonly attempt: JudgingAttempt,
    readonly workspaceId: WorkspaceId,
    readonly scale: ScoreScale,
    readonly value: number,
    readonly claimResults: readonly boolean[] | null,
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly model: string,
    readonly reasons: readonly JudgeReason[],
    readonly guidance: string | null,
    readonly referenced: boolean,
    readonly spent: ModelUsage,
    readonly at: Date,
  ) {}
}
