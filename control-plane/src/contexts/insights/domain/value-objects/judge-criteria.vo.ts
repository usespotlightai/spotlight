import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { InvalidRubricScaleError } from '@shared-kernel/domain/exceptions/invalid-rubric-scale.error';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';

const MAX_CLAIMS = 20;

const scaleOfRubric = (text: string): ScoreScale => {
  try {
    return ScoreScale.of(RubricScale.of(text).kind);
  } catch (error) {
    if (error instanceof InvalidRubricScaleError) {
      throw InvalidScoreError.ofJudging(
        `rubric is invalid. ${error.message.replace(/\.$/, '')}`,
      );
    }
    throw error;
  }
};

export class JudgeCriteria {
  private constructor(
    readonly rubric: string | null,
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly scale: ScoreScale,
  ) {}

  static of(input: {
    rubric: string | null;
    claims?: readonly string[];
    passThreshold?: number;
  }): JudgeCriteria {
    const rubric = input.rubric?.trim() ? input.rubric : null;
    const claims = (input.claims ?? []).map((each) => each.trim());
    const passThreshold = input.passThreshold ?? 1;

    if (rubric === null && claims.length === 0) {
      throw InvalidScoreError.ofJudging('needs a rubric or claims');
    }
    if (claims.length > MAX_CLAIMS || claims.some((each) => !each)) {
      throw InvalidScoreError.ofJudging(
        `claims must be at most ${MAX_CLAIMS}, none empty`,
      );
    }
    if (
      !Number.isFinite(passThreshold) ||
      passThreshold < 0 ||
      passThreshold > 1
    ) {
      throw InvalidScoreError.ofJudging('pass threshold must be from 0 to 1');
    }

    const scale =
      claims.length > 0 ? ScoreScale.claims() : scaleOfRubric(rubric ?? '');

    return new JudgeCriteria(rubric, claims, passThreshold, scale);
  }

  static readable(input: {
    rubric: string | null;
    claims?: readonly string[];
    passThreshold?: number;
  }): JudgeCriteria | null {
    try {
      return JudgeCriteria.of(input);
    } catch (error) {
      if (error instanceof InvalidScoreError) {
        return null;
      }
      throw error;
    }
  }

  equals(other: JudgeCriteria): boolean {
    return (
      this.rubric === other.rubric &&
      this.passThreshold === other.passThreshold &&
      this.claims.length === other.claims.length &&
      this.claims.every((each, at) => each === other.claims[at])
    );
  }
}
