import { InvalidJudgeCriteriaError } from '@shared-kernel/domain/exceptions/invalid-judge-criteria.error';
import { InvalidRubricScaleError } from '@shared-kernel/domain/exceptions/invalid-rubric-scale.error';
import { JudgeScale } from '@shared-kernel/domain/value-objects/judge-scale.vo';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';

const MAX_CLAIMS = 20;

const scaleOfRubric = (text: string): JudgeScale => {
  try {
    return JudgeScale.of(RubricScale.of(text).kind);
  } catch (error) {
    if (error instanceof InvalidRubricScaleError) {
      throw new InvalidJudgeCriteriaError(
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
    readonly scale: JudgeScale,
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
      throw new InvalidJudgeCriteriaError('needs a rubric or claims');
    }
    if (claims.length > MAX_CLAIMS || claims.some((each) => !each)) {
      throw new InvalidJudgeCriteriaError(
        `claims must be at most ${MAX_CLAIMS}, none empty`,
      );
    }
    if (
      !Number.isFinite(passThreshold) ||
      passThreshold < 0 ||
      passThreshold > 1
    ) {
      throw new InvalidJudgeCriteriaError('pass threshold must be from 0 to 1');
    }

    const scale =
      claims.length > 0 ? JudgeScale.of('claims') : scaleOfRubric(rubric ?? '');

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
      if (error instanceof InvalidJudgeCriteriaError) {
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
