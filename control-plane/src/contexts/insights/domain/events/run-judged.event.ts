import type { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import type { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunJudged implements DomainEvent {
  readonly kind = 'judging.judged';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly location: RunLocation,
    readonly fingerprint: ConfigFingerprint | null,
    readonly rubricVersion: RubricVersion,
    readonly scale: ScoreScale,
    readonly value: number,
    readonly claimResults: readonly boolean[] | null,
    readonly model: string,
    readonly reasons: readonly JudgeReason[],
    readonly seen: SeenEvidence,
    readonly at: Date,
  ) {}
}
