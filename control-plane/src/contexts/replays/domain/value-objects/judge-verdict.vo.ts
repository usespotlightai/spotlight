import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import { judgeGuidanceOf } from '@shared-kernel/domain/value-objects/judge-guidance';

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

const isRate = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= YES;

const isOnScale = (scale: JudgeScale, value: number): boolean => {
  switch (scale) {
    case 'yes-no':
      return value === 0 || value === YES;
    case 'number':
      return Number.isInteger(value) && value >= LOWEST && value <= HIGHEST;
    default:
      return isRate(value);
  }
};

const shareOf = (claimResults: readonly boolean[]): number =>
  claimResults.filter(Boolean).length / claimResults.length;

const claimResultsAreValid = (
  scale: JudgeScale,
  value: number,
  claimResults: readonly boolean[] | null,
): boolean =>
  scale === 'claims'
    ? claimResults !== null &&
      claimResults.length > 0 &&
      Math.abs(shareOf(claimResults) - value) <= LEEWAY
    : claimResults === null;

const isPassing = (
  scale: JudgeScale,
  value: number,
  passThreshold: number,
): boolean => {
  switch (scale) {
    case 'yes-no':
      return value === YES;
    case 'number':
      return value >= PASSING_SCORE;
    default:
      return value + LEEWAY >= passThreshold;
  }
};

export class JudgeVerdict {
  private constructor(
    readonly scale: JudgeScale,
    readonly value: number,
    readonly claimResults: readonly boolean[] | null,
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly model: string,
    readonly referenced: boolean,
    readonly reasons: readonly CitedReason[],
    readonly guidance: string | null,
  ) {}

  static of(input: {
    scale: string;
    value: number;
    claimResults: readonly boolean[] | null;
    claims: readonly string[];
    passThreshold: number;
    model: string;
    referenced: boolean;
    reasons: readonly CitedReason[];
    guidance: string | null;
  }): JudgeVerdict {
    const { claimResults, passThreshold } = input;

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
    if (!claimResultsAreValid(input.scale, input.value, claimResults)) {
      throw new InvalidReplayError(
        'judge must mark claims only when it judges by claims',
      );
    }
    if ((claimResults?.length ?? 0) !== input.claims.length) {
      throw new InvalidReplayError(
        'judge must name exactly the claims it marks',
      );
    }
    if (!isRate(passThreshold)) {
      throw new InvalidReplayError('judge pass threshold must be from 0 to 1');
    }

    return new JudgeVerdict(
      input.scale,
      input.value,
      claimResults && [...claimResults],
      [...input.claims],
      passThreshold,
      input.model,
      input.referenced,
      input.reasons.map((each) => ({
        text: each.text,
        steps: [...each.steps],
        hunks: [...each.hunks],
        claim: each.claim,
      })),
      isPassing(input.scale, input.value, passThreshold)
        ? null
        : judgeGuidanceOf(input.guidance),
    );
  }

  get passes(): boolean {
    return isPassing(this.scale, this.value, this.passThreshold);
  }

  equals(other: JudgeVerdict): boolean {
    return (
      this.scale === other.scale &&
      this.value === other.value &&
      JSON.stringify(this.claimResults) ===
        JSON.stringify(other.claimResults) &&
      JSON.stringify(this.claims) === JSON.stringify(other.claims) &&
      this.passThreshold === other.passThreshold &&
      this.model === other.model &&
      this.referenced === other.referenced &&
      JSON.stringify(this.reasons) === JSON.stringify(other.reasons) &&
      this.guidance === other.guidance
    );
  }
}
