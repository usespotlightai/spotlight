import type { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import type { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import type { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunJudged implements DomainEvent {
  readonly kind = 'judging.judged';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly place: RunPlace,
    readonly fingerprint: string | null,
    readonly rubricVersion: string,
    readonly scale: ScoreScale,
    readonly value: number,
    readonly marks: readonly boolean[] | null,
    readonly model: string,
    readonly reasons: readonly JudgeReason[],
    readonly seen: SeenEvidence,
    readonly at: Date,
  ) {}
}
