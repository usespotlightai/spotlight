import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
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
    passShare?: number;
    version: string;
  }): Rubric {
    const criteria = JudgeCriteria.of({
      rubric: input.text,
      claims: input.claims,
      passShare: input.passShare,
    });

    if (!isRubricVersion(input.version)) {
      throw InvalidScoreError.ofJudging(
        'names its rubric by a 64-character hex digest',
      );
    }

    return new Rubric(criteria, input.version);
  }

  static readable(input: {
    text: string | null;
    claims?: readonly string[];
    passShare?: number;
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
