import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import {
  claimShareOf,
  isJudgeScaleKind,
  JUDGE_SCALE_KINDS,
  JudgeScale,
  type JudgeScaleKind,
} from '@shared-kernel/domain/value-objects/judge-scale.vo';

export const SCORE_KINDS = JUDGE_SCALE_KINDS;

export type ScoreKind = JudgeScaleKind;

const YES = 1;

const NO = 0;

const LOWEST = 1;

const HIGHEST = 5;

const PERCENT = 100;

const VALUES: Record<ScoreKind, readonly number[]> = {
  'yes-no': [NO, YES],
  number: Array.from({ length: HIGHEST - LOWEST + 1 }, (_, at) => LOWEST + at),
  claims: [NO, YES],
};

export class ScoreScale extends JudgeScale {
  static override of(kind: string): ScoreScale {
    if (!isJudgeScaleKind(kind)) {
      throw new InvalidScoreError(
        `scale must be one of ${SCORE_KINDS.join(', ')}, not ${kind}`,
      );
    }

    return new ScoreScale(kind);
  }

  static yesNo(): ScoreScale {
    return new ScoreScale('yes-no');
  }

  static oneToFive(): ScoreScale {
    return new ScoreScale('number');
  }

  static claims(): ScoreScale {
    return new ScoreScale('claims');
  }

  get values(): readonly number[] {
    return VALUES[this.kind];
  }

  get categorical(): boolean {
    return this.kind === 'yes-no';
  }

  valueOf(raw: boolean | number): number {
    if (this.kind === 'yes-no') {
      if (typeof raw !== 'boolean') {
        throw new InvalidScoreError('on a yes or no scale must be yes or no');
      }
      return raw ? YES : NO;
    }

    if (this.byClaims) {
      throw new InvalidScoreError(
        'on a claims scale must mark each claim as met or not met',
      );
    }

    if (typeof raw !== 'number' || !this.includes(raw)) {
      throw new InvalidScoreError(
        `on a number scale must be a whole number from ${LOWEST} to ${HIGHEST}`,
      );
    }

    return raw;
  }

  valueOfClaims(claimResults: readonly boolean[], count: number): number {
    if (!this.byClaims) {
      throw new InvalidScoreError(
        `on a ${this.kind} scale must be one value, not claim by claim`,
      );
    }
    if (count === 0 || claimResults.length !== count) {
      throw new InvalidScoreError(
        `on a claims scale must mark all ${count} claims as met or not met`,
      );
    }

    return claimShareOf(claimResults);
  }

  labelOf(value: number): string {
    if (this.kind === 'yes-no') {
      return value === YES ? 'yes' : 'no';
    }
    if (this.byClaims) {
      return `${Math.round(value * PERCENT)}% of claims met`;
    }

    return String(value);
  }

  get yes(): number {
    return YES;
  }

  get no(): number {
    return NO;
  }
}
