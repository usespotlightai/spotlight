import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import {
  fromJudgeSource,
  type ScoreSource,
} from '@insights/domain/value-objects/score-source';
import type { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface Scored {
  readonly id: ScoreId;
  readonly runId: RunId;
  readonly location: RunLocation;
  readonly source: ScoreSource;
  readonly scale: ScoreScale;
  readonly value: number;
  readonly claimResults: readonly boolean[] | null;
  readonly rubricVersion: RubricVersion | null;
  readonly model: string | null;
  readonly reasons: readonly JudgeReason[];
  readonly seen: SeenEvidence;
  readonly by: UserId | null;
  readonly at: Date;
  readonly fromJudge: boolean;
}

type ScoreFactParts = Omit<Scored, 'fromJudge'>;

export class ScoreFact implements Scored {
  readonly id!: ScoreId;
  readonly runId!: RunId;
  readonly location!: RunLocation;
  readonly source!: ScoreSource;
  readonly scale!: ScoreScale;
  readonly value!: number;
  readonly claimResults!: readonly boolean[] | null;
  readonly rubricVersion!: RubricVersion | null;
  readonly model!: string | null;
  readonly reasons!: readonly JudgeReason[];
  readonly seen!: SeenEvidence;
  readonly by!: UserId | null;
  readonly at!: Date;

  private constructor(parts: ScoreFactParts) {
    Object.assign(this, parts);
  }

  static of(parts: ScoreFactParts): ScoreFact {
    return new ScoreFact(parts);
  }

  get fromJudge(): boolean {
    return fromJudgeSource(this.source);
  }
}
