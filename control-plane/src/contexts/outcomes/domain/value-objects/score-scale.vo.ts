import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';

export const SCORE_KINDS = ['yes-no', 'number'] as const;

export type ScoreKind = (typeof SCORE_KINDS)[number];

const YES = 1;

const NO = 0;

const LOWEST = 1;

const HIGHEST = 5;

const VALUES: Record<ScoreKind, readonly number[]> = {
  'yes-no': [NO, YES],
  number: Array.from({ length: HIGHEST - LOWEST + 1 }, (_, at) => LOWEST + at),
};

const isKind = (raw: string): raw is ScoreKind =>
  SCORE_KINDS.some((each) => each === raw);

export class ScoreScale {
  private constructor(readonly kind: ScoreKind) {}

  static of(kind: string): ScoreScale {
    if (!isKind(kind)) {
      throw new InvalidScoreError(
        `is one of ${SCORE_KINDS.join(', ')}, not ${kind}`,
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

  get values(): readonly number[] {
    return VALUES[this.kind];
  }

  get categorical(): boolean {
    return this.kind === 'yes-no';
  }

  holds(value: number): boolean {
    return this.values.includes(value);
  }

  valueOf(raw: boolean | number): number {
    if (this.kind === 'yes-no') {
      if (typeof raw !== 'boolean') {
        throw new InvalidScoreError('on a yes or no scale is yes or no');
      }
      return raw ? YES : NO;
    }

    if (typeof raw !== 'number' || !this.holds(raw)) {
      throw new InvalidScoreError(
        `on a number scale is a whole number from ${LOWEST} to ${HIGHEST}`,
      );
    }

    return raw;
  }

  labelOf(value: number): string {
    if (this.kind === 'yes-no') {
      return value === YES ? 'yes' : 'no';
    }

    return String(value);
  }

  get yes(): number {
    return YES;
  }

  get no(): number {
    return NO;
  }

  equals(other: ScoreScale): boolean {
    return this.kind === other.kind;
  }
}
