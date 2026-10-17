import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';

export const JUDGE_SCALES = ['yes-no', 'number', 'claims'] as const;

export type JudgeScale = (typeof JUDGE_SCALES)[number];

export const PASSING_SCORE = 4;

const YES = 1;

const LOWEST = 1;

const HIGHEST = 5;

const LEEWAY = 1e-9;

export interface CitedReason {
  readonly text: string;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
  readonly claim: number | null;
}

const isScale = (raw: string): raw is JudgeScale =>
  (JUDGE_SCALES as readonly string[]).includes(raw);

const isShare = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= YES;

const isOnScale = (scale: JudgeScale, value: number): boolean => {
  switch (scale) {
    case 'yes-no':
      return value === 0 || value === YES;
    case 'number':
      return Number.isInteger(value) && value >= LOWEST && value <= HIGHEST;
    default:
      return isShare(value);
  }
};

const shareOf = (marks: readonly boolean[]): number =>
  marks.filter(Boolean).length / marks.length;

const marksAreValid = (
  scale: JudgeScale,
  value: number,
  marks: readonly boolean[] | null,
): boolean =>
  scale === 'claims'
    ? marks !== null &&
      marks.length > 0 &&
      Math.abs(shareOf(marks) - value) <= LEEWAY
    : marks === null;

export class JudgeVerdict {
  private constructor(
    readonly scale: JudgeScale,
    readonly value: number,
    readonly marks: readonly boolean[] | null,
    readonly claims: readonly string[],
    readonly passShare: number,
    readonly model: string,
    readonly referenced: boolean,
    readonly reasons: readonly CitedReason[],
  ) {}

  static of(input: {
    scale: string;
    value: number;
    marks: readonly boolean[] | null;
    claims: readonly string[];
    passShare: number;
    model: string;
    referenced: boolean;
    reasons: readonly CitedReason[];
  }): JudgeVerdict {
    const { marks, passShare } = input;

    if (!isScale(input.scale)) {
      throw new InvalidReplayError(
        `judge must score yes or no, ${LOWEST} to ${HIGHEST}, or by claims, not ${input.scale}`,
      );
    }
    if (!isOnScale(input.scale, input.value)) {
      throw new InvalidReplayError(
        `judge score ${input.value} is not on the ${input.scale} scale`,
      );
    }
    if (!marksAreValid(input.scale, input.value, marks)) {
      throw new InvalidReplayError(
        'judge must mark claims only when it judges by claims',
      );
    }
    if ((marks?.length ?? 0) !== input.claims.length) {
      throw new InvalidReplayError(
        'judge must name exactly the claims it marks',
      );
    }
    if (!isShare(passShare)) {
      throw new InvalidReplayError('judge pass share must be from 0 to 1');
    }

    return new JudgeVerdict(
      input.scale,
      input.value,
      marks && [...marks],
      [...input.claims],
      passShare,
      input.model,
      input.referenced,
      input.reasons.map((each) => ({
        text: each.text,
        steps: [...each.steps],
        hunks: [...each.hunks],
        claim: each.claim,
      })),
    );
  }

  get passes(): boolean {
    switch (this.scale) {
      case 'yes-no':
        return this.value === YES;
      case 'number':
        return this.value >= PASSING_SCORE;
      default:
        return this.value + LEEWAY >= this.passShare;
    }
  }

  equals(other: JudgeVerdict): boolean {
    return (
      this.scale === other.scale &&
      this.value === other.value &&
      JSON.stringify(this.marks) === JSON.stringify(other.marks) &&
      JSON.stringify(this.claims) === JSON.stringify(other.claims) &&
      this.passShare === other.passShare &&
      this.model === other.model &&
      this.referenced === other.referenced &&
      JSON.stringify(this.reasons) === JSON.stringify(other.reasons)
    );
  }
}
