import { InvalidJudgeCriteriaError } from '@shared-kernel/domain/exceptions/invalid-judge-criteria.error';

export const JUDGE_SCALE_KINDS = ['yes-no', 'number', 'claims'] as const;

export type JudgeScaleKind = (typeof JUDGE_SCALE_KINDS)[number];

export const PASSING_SCORE = 4;

const YES = 1;

const NO = 0;

const LOWEST = 1;

const HIGHEST = 5;

const LEEWAY = 1e-9;

export const isJudgeScaleKind = (raw: string): raw is JudgeScaleKind =>
  JUDGE_SCALE_KINDS.some((each) => each === raw);

export const claimShareOf = (claimResults: readonly boolean[]): number =>
  claimResults.filter(Boolean).length / claimResults.length;

export class JudgeScale {
  protected constructor(readonly kind: JudgeScaleKind) {}

  static of(kind: string): JudgeScale {
    if (!isJudgeScaleKind(kind)) {
      throw new InvalidJudgeCriteriaError(
        `must score yes or no, ${LOWEST} to ${HIGHEST}, or by claims, not ${kind}`,
      );
    }

    return new JudgeScale(kind);
  }

  get byClaims(): boolean {
    return this.kind === 'claims';
  }

  includes(value: number): boolean {
    switch (this.kind) {
      case 'yes-no':
        return value === NO || value === YES;
      case 'number':
        return Number.isInteger(value) && value >= LOWEST && value <= HIGHEST;
      case 'claims':
        return Number.isFinite(value) && value >= NO && value <= YES;
    }
  }

  marks(value: number, claimResults: readonly boolean[] | null): boolean {
    return this.byClaims
      ? claimResults !== null &&
          claimResults.length > 0 &&
          Math.abs(claimShareOf(claimResults) - value) <= LEEWAY
      : claimResults === null;
  }

  passes(value: number, passThreshold: number): boolean {
    switch (this.kind) {
      case 'yes-no':
        return value === YES;
      case 'number':
        return value >= PASSING_SCORE;
      case 'claims':
        return value + LEEWAY >= passThreshold;
    }
  }

  equals(other: JudgeScale): boolean {
    return this.kind === other.kind;
  }
}
