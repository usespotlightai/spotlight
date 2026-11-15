import { InvalidRubricError } from '@insights/domain/exceptions/invalid-rubric.error';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { InvalidJudgeCriteriaError } from '@shared-kernel/domain/exceptions/invalid-judge-criteria.error';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';

interface RubricInput {
  readonly claims: readonly string[];
  readonly passThreshold?: number;
  readonly version: string;
}

export class Rubric {
  private constructor(
    readonly criteria: JudgeCriteria,
    readonly version: RubricVersion,
  ) {}

  static of(input: RubricInput): Rubric {
    const criteria = JudgeCriteria.of({
      claims: input.claims,
      passThreshold: input.passThreshold,
    });
    const version = RubricVersion.readable(input.version);

    if (!version) {
      throw new InvalidRubricError('version must be 64 hex characters');
    }

    return new Rubric(criteria, version);
  }

  static readable(input: RubricInput): Rubric | null {
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

  get claims(): readonly string[] {
    return this.criteria.claims;
  }

  get passThreshold(): number {
    return this.criteria.passThreshold;
  }
}
