import type { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface AnsweredDisagreements {
  readonly stationId: StationId;
  readonly rubricVersion: RubricVersion;
  readonly since: Date | null;
}

export interface JudgeDisagreementRepository extends ScopedRemoval<JudgeDisagreement> {
  add(disagreement: JudgeDisagreement): Promise<void>;

  save(disagreement: JudgeDisagreement): Promise<void>;

  find(id: JudgeDisagreementId): Promise<JudgeDisagreement | null>;

  ofRun(runId: RunId): Promise<readonly JudgeDisagreement[]>;

  outdatedAtStation(
    stationId: StationId,
    current: RubricVersion | null,
    max: number,
  ): Promise<readonly JudgeDisagreement[]>;

  answeredAt(
    criteria: AnsweredDisagreements,
  ): Promise<readonly JudgeDisagreement[]>;
}
