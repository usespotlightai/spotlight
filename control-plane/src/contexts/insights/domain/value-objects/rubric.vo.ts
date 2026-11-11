import { InvalidRubricError } from '@insights/domain/exceptions/invalid-rubric.error';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { InvalidJudgeCriteriaError } from '@shared-kernel/domain/exceptions/invalid-judge-criteria.error';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';

export class Rubric {
  private constructor(
    readonly criteria: JudgeCriteria,
    readonly version: RubricVersion,
  ) {}

  static of(input: {
    text: string | null;
    claims?: readonly string[];
    passThreshold?: number;
    version: string;
  }): Rubric {
    const criteria = JudgeCriteria.of({
      rubric: input.text,
      claims: input.claims,
      passThreshold: input.passThreshold,
    });

    const version = RubricVersion.readable(input.version);

    if (!version) {
      throw new InvalidRubricError('version must be 64 hex characters');
    }

    return new Rubric(criteria, version);
  }

  static readable(input: {
    text: string | null;
    claims?: readonly string[];
    passThreshold?: number;
    version: string;
  }): Rubric | null {
    try {
      return Rubric.of(input);
    } catch (error) {
      if (
        error instanceof InvalidRubricError ||
        error instanceof InvalidJudgeCriteriaError
      ) {
        return null;
      }
      throw error;
    }
  }

  get text(): string | null {
    return this.criteria.rubric;
  }

  get body(): string | null {
    const text = this.criteria.rubric;

    if (text === null) {
      return null;
    }

    return (
      (this.scale.byClaims ? text.trim() : RubricScale.bodyOf(text)) || null
    );
  }

  get scale(): ScoreScale {
    return ScoreScale.of(this.criteria.scale.kind);
  }
}
