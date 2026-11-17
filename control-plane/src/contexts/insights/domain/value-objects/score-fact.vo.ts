import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { ScoreOrigin } from '@insights/domain/value-objects/score-origin';
import type { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import {
  claimShareOf,
  passesAt,
} from '@shared-kernel/domain/value-objects/claim-share';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface Scored {
  readonly id: ScoreId;
  readonly runId: RunId;
  readonly location: RunLocation;
  readonly origin: ScoreOrigin;
  readonly claimResults: readonly boolean[];
  readonly passThreshold: number;
  readonly rubricVersion: RubricVersion;
  readonly model: string;
  readonly reasons: readonly JudgeReason[];
  readonly seen: SeenEvidence;
  readonly at: Date;
  readonly value: number;
  readonly passes: boolean;
}

type ScoreFactParts = Omit<Scored, 'value' | 'passes'>;

export class ScoreFact implements Scored {
  readonly id!: ScoreId;
  readonly runId!: RunId;
  readonly location!: RunLocation;
  readonly origin!: ScoreOrigin;
  readonly claimResults!: readonly boolean[];
  readonly passThreshold!: number;
  readonly rubricVersion!: RubricVersion;
  readonly model!: string;
  readonly reasons!: readonly JudgeReason[];
  readonly seen!: SeenEvidence;
  readonly at!: Date;

  private constructor(parts: ScoreFactParts) {
    Object.assign(this, parts);
  }

  static of(parts: ScoreFactParts): ScoreFact {
    return new ScoreFact(parts);
  }

  get value(): number {
    return claimShareOf(this.claimResults);
  }

  get passes(): boolean {
    return passesAt(this.value, this.passThreshold);
  }
}
