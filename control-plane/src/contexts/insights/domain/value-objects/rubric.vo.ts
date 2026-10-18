import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';

const VERSION = /^[0-9a-f]{64}$/;

export const isRubricVersion = (raw: string): boolean => VERSION.test(raw);

export class Rubric {
  private constructor(
    readonly criteria: JudgeCriteria,
    readonly version: string,
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

    if (!isRubricVersion(input.version)) {
      throw InvalidScoreError.ofJudging(
        'rubric hash must be 64 hex characters',
      );
    }

    return new Rubric(criteria, input.version);
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
      if (error instanceof InvalidScoreError) {
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
    return this.criteria.scale;
  }
}
