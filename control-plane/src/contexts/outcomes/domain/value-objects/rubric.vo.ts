import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { InvalidRubricScaleError } from '@shared-kernel/domain/exceptions/invalid-rubric-scale.error';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';

const VERSION = /^[0-9a-f]{64}$/;

export const isRubricVersion = (raw: string): boolean => VERSION.test(raw);

const scaleOf = (text: string): ScoreScale => {
  try {
    return ScoreScale.of(RubricScale.of(text).kind);
  } catch (error) {
    if (error instanceof InvalidRubricScaleError) {
      throw InvalidScoreError.ofJudging(`has a rubric whose ${error.message}`);
    }
    throw error;
  }
};

export class Rubric {
  private constructor(
    readonly text: string,
    readonly version: string,
    readonly scale: ScoreScale,
  ) {}

  static of(input: { text: string; version: string }): Rubric {
    if (!input.text.trim()) {
      throw InvalidScoreError.ofJudging('has a rubric to judge by');
    }
    if (!isRubricVersion(input.version)) {
      throw InvalidScoreError.ofJudging(
        'names its rubric by a 64-character hex digest',
      );
    }

    return new Rubric(input.text, input.version, scaleOf(input.text));
  }

  static readable(input: { text: string; version: string }): Rubric | null {
    try {
      return Rubric.of(input);
    } catch (error) {
      if (error instanceof InvalidScoreError) {
        return null;
      }
      throw error;
    }
  }
}
