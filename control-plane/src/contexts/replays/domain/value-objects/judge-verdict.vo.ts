import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';

export const JUDGE_SCALES = ['yes-no', 'number'] as const;

export type JudgeScale = (typeof JUDGE_SCALES)[number];

export const PASSING_SCORE = 4;

const YES = 1;

const LOWEST = 1;

const HIGHEST = 5;

export interface CitedReason {
  readonly text: string;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
}

const isScale = (raw: string): raw is JudgeScale =>
  (JUDGE_SCALES as readonly string[]).includes(raw);

const holds = (scale: JudgeScale, value: number): boolean =>
  scale === 'yes-no'
    ? value === 0 || value === YES
    : Number.isInteger(value) && value >= LOWEST && value <= HIGHEST;

export class JudgeVerdict {
  private constructor(
    readonly scale: JudgeScale,
    readonly value: number,
    readonly model: string,
    readonly referenced: boolean,
    readonly reasons: readonly CitedReason[],
  ) {}

  static of(input: {
    scale: string;
    value: number;
    model: string;
    referenced: boolean;
    reasons: readonly CitedReason[];
  }): JudgeVerdict {
    if (!isScale(input.scale)) {
      throw new InvalidReplayError(
        `judge scores yes or no, or from ${LOWEST} to ${HIGHEST}, not on a ${input.scale} scale`,
      );
    }
    if (!holds(input.scale, input.value)) {
      throw new InvalidReplayError(
        `judge’s score ${input.value} is not on its ${input.scale} scale`,
      );
    }

    return new JudgeVerdict(
      input.scale,
      input.value,
      input.model,
      input.referenced,
      input.reasons.map((each) => ({
        text: each.text,
        steps: [...each.steps],
        hunks: [...each.hunks],
      })),
    );
  }

  get passes(): boolean {
    return this.scale === 'yes-no'
      ? this.value === YES
      : this.value >= PASSING_SCORE;
  }

  equals(other: JudgeVerdict): boolean {
    return (
      this.scale === other.scale &&
      this.value === other.value &&
      this.model === other.model &&
      this.referenced === other.referenced &&
      JSON.stringify(this.reasons) === JSON.stringify(other.reasons)
    );
  }
}
